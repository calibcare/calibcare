/**
 * Given days-until-due, picks the single most urgent reminder bucket that
 * currently applies. Using "<=" thresholds (not exact equality) means a
 * missed cron run (e.g. server down for a day) still lands in a bucket next
 * time it runs, instead of silently skipping that equipment's reminder.
 *
 * 'overdue' is not a reminder -- nothing is sent for it (see RULE_LABEL) --
 * but the dashboard still uses it to split overdue from due-soon.
 */
export function pickBucket(daysUntilDue) {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 1) return '1_day';
  if (daysUntilDue <= 7) return '7_days';
  if (daysUntilDue <= 30) return '30_days';
  return null;
}

const BUCKET_LABEL = {
  '1_day': 'is due for calibration within 1 day',
  '7_days': 'is due for calibration in 7 days or less',
  '30_days': 'is due for calibration in 30 days or less',
};

// The buckets that actually send a reminder, with their labels for the
// reminder-rules UI -- phrased as a rule name rather than a message sentence.
export const RULE_LABEL = {
  '30_days': '30 days before due date',
  '7_days': '7 days before due date',
  '1_day': '1 day before due date',
};

// Buckets that used to send reminders (before 2026-10-27) -- kept only so
// old notification_log rows still show a readable label in the history.
export const LEGACY_RULE_LABEL = {
  '14_days': '14 days before due date',
  due: 'Due today',
  overdue: 'Overdue',
};

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function buildMessage(equipment, bucket, nextCalibrationDate) {
  return `[CalibCare] ${equipment.name} (${equipment.model}, S/N ${equipment.serial_number}) ${BUCKET_LABEL[bucket]}. Next calibration date: ${formatDate(nextCalibrationDate)}.`;
}

function buildEmailSubject(equipment) {
  return `[CalibCare] Calibration reminder: ${equipment.name}`;
}

// Used when no email client is supplied -- keeps checkAndSendReminders
// callable exactly as before for anything that doesn't care about email.
const NOOP_EMAIL_CLIENT = {
  dryRun: true,
  async send() {
    return { ok: true, dryRun: true };
  },
};

async function alreadySent(db, calibrationId, bucket, channel) {
  const [rows] = await db.query(
    "SELECT 1 FROM notification_log WHERE calibration_id = ? AND notification_type = ? AND channel = ? AND status = 'sent' LIMIT 1",
    [calibrationId, bucket, channel]
  );
  return rows.length > 0;
}

async function logNotification(db, calibrationId, userId, bucket, channel, status) {
  await db.query(
    'INSERT INTO notification_log (calibration_id, user_id, notification_type, channel, status) VALUES (?, ?, ?, ?, ?)',
    [calibrationId, userId, bucket, channel, status]
  );
}

// Dedup is per (calibration, bucket, channel) -- a bucket that already sent
// on LINE but never attempted email must not be blocked from trying email
// once a Deputy Manager turns that channel on later. One caveat, same as
// this table has always had for LINE: dedup checks whether ANY recipient
// succeeded, not every recipient individually -- so a partial failure (some
// recipients sent, one failed) won't auto-retry just that one recipient.
async function sendLineChannel(db, row, bucket, equipment, recipients, lineClient) {
  if (await alreadySent(db, row.calibration_id, bucket, 'LINE')) {
    return { channel: 'LINE', skipped: 'already notified' };
  }
  if (recipients.length === 0) {
    return { channel: 'LINE', skipped: 'no recipients with a line_user_id' };
  }

  const message = buildMessage(equipment, bucket, row.next_calibration_date);
  const userIds = recipients.map((r) => r.line_user_id);
  const sendResult = await lineClient.multicast(userIds, message);
  const status = sendResult.ok ? 'sent' : 'failed';

  // Dry-run "sends" are never logged: if a dry-run send were logged as
  // 'sent', the real reminder would silently never fire once a real
  // LINE_CHANNEL_ACCESS_TOKEN is configured.
  if (!lineClient.dryRun) {
    for (const recipient of recipients) {
      await logNotification(db, row.calibration_id, recipient.user_id, bucket, 'LINE', status);
    }
  }

  return { channel: 'LINE', status, notified: recipients.length, dryRun: Boolean(lineClient.dryRun) };
}

// Email has no bulk-send API like LINE's multicast, so each recipient is
// sent to (and logged) individually -- a partial failure here is visible
// per-recipient, unlike LINE's single batch outcome.
async function sendEmailChannel(db, row, bucket, equipment, recipients, emailClient) {
  if (await alreadySent(db, row.calibration_id, bucket, 'EMAIL')) {
    return { channel: 'EMAIL', skipped: 'already notified' };
  }
  if (recipients.length === 0) {
    return { channel: 'EMAIL', skipped: 'no recipients with a verified email' };
  }

  const subject = buildEmailSubject(equipment);
  const text = buildMessage(equipment, bucket, row.next_calibration_date);

  let anyFailed = false;
  for (const recipient of recipients) {
    const sendResult = await emailClient.send(recipient.email, subject, text);
    const status = sendResult.ok ? 'sent' : 'failed';
    if (status === 'failed') anyFailed = true;
    if (!emailClient.dryRun) {
      await logNotification(db, row.calibration_id, recipient.user_id, bucket, 'EMAIL', status);
    }
  }

  return { channel: 'EMAIL', status: anyFailed ? 'failed' : 'sent', notified: recipients.length, dryRun: Boolean(emailClient.dryRun) };
}

/**
 * db: an object with an async query(sql, params) method (mysql2 pool-shaped).
 * lineClient: from createLineClient() -- real or dry-run.
 * emailClient: from emailService.createEmailClient() -- real or dry-run;
 *   defaults to a no-op dry-run client so existing LINE-only callers don't
 *   need to change.
 * today: injectable for tests; defaults to now.
 *
 * Returns a summary of what was evaluated/sent, for logging or an API
 * response -- one entry per due item, each carrying a `channels` array
 * (one entry per channel its bucket's rule has turned on).
 */
export async function checkAndSendReminders(db, lineClient, emailClient = NOOP_EMAIL_CLIENT, today = new Date()) {
  const todayStr = today.toISOString().slice(0, 10);

  const [dueRows] = await db.query(
    `SELECT ch.calibration_id, ch.equipment_id, ch.next_calibration_date,
            e.name, e.model, e.serial_number,
            DATEDIFF(ch.next_calibration_date, ?) AS days_until_due
     FROM calibration_history ch
     INNER JOIN (
       SELECT equipment_id, MAX(calibration_date) AS max_date
       FROM calibration_history
       GROUP BY equipment_id
     ) latest ON latest.equipment_id = ch.equipment_id AND latest.max_date = ch.calibration_date
     JOIN equipment e ON e.equipment_id = ch.equipment_id
     WHERE e.status = 'active' AND ch.next_calibration_date IS NOT NULL`,
    [todayStr]
  );

  const [ruleRows] = await db.query('SELECT bucket, enabled, send_line, send_email FROM reminder_rule');
  const rules = new Map(ruleRows.map((r) => [r.bucket, r]));

  const [lineRecipients] = await db.query(
    'SELECT user_id, line_user_id FROM users WHERE line_user_id IS NOT NULL AND line_user_id != ""'
  );
  const [emailRecipients] = await db.query('SELECT user_id, email FROM users WHERE email_verified = 1');

  const results = [];

  for (const row of dueRows) {
    const bucket = pickBucket(row.days_until_due);
    if (!RULE_LABEL[bucket]) continue; // not due within 30 days, or overdue -- no reminder

    const rule = rules.get(bucket);
    if (!rule || !rule.enabled) {
      results.push({ equipment: row.name, serial_number: row.serial_number, bucket, skipped: 'rule disabled' });
      continue;
    }

    const equipment = { name: row.name, model: row.model, serial_number: row.serial_number };
    const channels = [];

    if (rule.send_line) {
      channels.push(await sendLineChannel(db, row, bucket, equipment, lineRecipients, lineClient));
    }
    if (rule.send_email) {
      channels.push(await sendEmailChannel(db, row, bucket, equipment, emailRecipients, emailClient));
    }

    if (channels.length === 0) {
      results.push({ equipment: row.name, serial_number: row.serial_number, bucket, skipped: 'rule has no channels enabled' });
      continue;
    }

    results.push({ equipment: row.name, serial_number: row.serial_number, bucket, channels });
  }

  return results;
}
