import { Router } from 'express';
import 'dotenv/config';
import { pool } from '../db.js';
import { createLineClient } from '../services/lineClient.js';
import { createEmailClient, emailDryRun } from '../services/emailService.js';
import { checkAndSendReminders, RULE_LABEL } from '../services/reminderService.js';
import { requireCapability } from '../middleware/auth.js';

export const remindersRouter = Router();

const VALID_BUCKETS = Object.keys(RULE_LABEL);

// POST /api/reminders/run -- manually trigger the daily check (Deputy Manager only).
// Exists so the reminder logic can be tested/demoed without waiting for the
// cron schedule to fire.
remindersRouter.post('/run', requireCapability('canRunReminders'), async (req, res, next) => {
  try {
    const lineClient = createLineClient(process.env.LINE_CHANNEL_ACCESS_TOKEN);
    const emailClient = createEmailClient();
    const results = await checkAndSendReminders(pool, lineClient, emailClient);
    res.json({ lineDryRun: lineClient.dryRun, emailDryRun: emailClient.dryRun, results });
  } catch (err) {
    next(err);
  }
});

// GET /api/reminders/rules -- the 5 real buckets with their on/off + channel
// state (any logged-in role can view; only a Deputy Manager can change one).
remindersRouter.get('/rules', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT bucket, enabled, send_line, send_email FROM reminder_rule');
    const rules = VALID_BUCKETS.map((bucket) => {
      const row = rows.find((r) => r.bucket === bucket) || { enabled: 1, send_line: 1, send_email: 0 };
      return {
        bucket,
        label: RULE_LABEL[bucket],
        enabled: Boolean(row.enabled),
        send_line: Boolean(row.send_line),
        send_email: Boolean(row.send_email),
      };
    });
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reminders/rules/:bucket -- Deputy Manager only.
remindersRouter.patch('/rules/:bucket', requireCapability('canRunReminders'), async (req, res, next) => {
  try {
    const { bucket } = req.params;
    if (!VALID_BUCKETS.includes(bucket)) {
      return res.status(400).json({ error: `bucket must be one of ${VALID_BUCKETS.join(', ')}` });
    }

    const { enabled, send_line, send_email } = req.body;
    const updates = [];
    const params = [];
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    if (send_line !== undefined) {
      updates.push('send_line = ?');
      params.push(send_line ? 1 : 0);
    }
    if (send_email !== undefined) {
      updates.push('send_email = ?');
      params.push(send_email ? 1 : 0);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'no editable fields provided (enabled, send_line, send_email)' });
    }
    updates.push('updated_by = ?');
    params.push(req.user.user_id);

    params.push(bucket);
    await pool.query(`UPDATE reminder_rule SET ${updates.join(', ')} WHERE bucket = ?`, params);

    const [rows] = await pool.query('SELECT bucket, enabled, send_line, send_email FROM reminder_rule WHERE bucket = ?', [bucket]);
    res.json({
      bucket,
      label: RULE_LABEL[bucket],
      enabled: Boolean(rows[0].enabled),
      send_line: Boolean(rows[0].send_line),
      send_email: Boolean(rows[0].send_email),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reminders/summary -- real stand-ins for "last run"/"connection
// status": the app has no record of the external Railway Cron Job's
// schedule, so there's deliberately no "next run" field here.
remindersRouter.get('/summary', async (req, res, next) => {
  try {
    const [[{ lastSentAt }]] = await pool.query("SELECT MAX(sent_at) AS lastSentAt FROM notification_log WHERE status = 'sent'");
    const [[{ sentLast24h }]] = await pool.query(
      "SELECT COUNT(*) AS sentLast24h FROM notification_log WHERE status = 'sent' AND sent_at >= NOW() - INTERVAL 1 DAY"
    );
    const [[{ lineRecipientCount }]] = await pool.query(
      'SELECT COUNT(*) AS lineRecipientCount FROM users WHERE line_user_id IS NOT NULL AND line_user_id != ""'
    );
    const [[{ emailRecipientCount }]] = await pool.query('SELECT COUNT(*) AS emailRecipientCount FROM users WHERE email_verified = 1');

    res.json({ lastSentAt, sentLast24h, lineRecipientCount, emailRecipientCount, emailDryRun });
  } catch (err) {
    next(err);
  }
});

// GET /api/reminders/history?days=7&limit=&offset= -- real notification_log
// rows, newest first.
remindersRouter.get('/history', async (req, res, next) => {
  try {
    const { days = 7, limit = 20, offset = 0 } = req.query;
    const safeDays = Math.max(1, Number(days) || 7);
    const safeLimit = Math.min(Number(limit) || 20, 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const [rows] = await pool.query(
      `SELECT n.notification_id, n.notification_type, n.channel, n.status, n.sent_at,
              e.name, e.model, e.serial_number
       FROM notification_log n
       JOIN calibration_history ch ON ch.calibration_id = n.calibration_id
       JOIN equipment e ON e.equipment_id = ch.equipment_id
       WHERE n.sent_at >= NOW() - INTERVAL ? DAY
       ORDER BY n.sent_at DESC, n.notification_id DESC
       LIMIT ? OFFSET ?`,
      [safeDays, safeLimit, safeOffset]
    );
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM notification_log WHERE sent_at >= NOW() - INTERVAL ? DAY',
      [safeDays]
    );

    res.json({
      total,
      limit: safeLimit,
      offset: safeOffset,
      history: rows.map((r) => ({ ...r, label: RULE_LABEL[r.notification_type] || r.notification_type })),
    });
  } catch (err) {
    next(err);
  }
});
