import { Router } from 'express';
import 'dotenv/config';
import { pool } from '../db.js';
import { createLineClient } from '../services/lineClient.js';
import { checkAndSendReminders } from '../services/reminderService.js';
import { requireRole } from '../middleware/auth.js';

export const remindersRouter = Router();

// POST /api/reminders/run -- manually trigger the daily check (admin only).
// Exists so the reminder logic can be tested/demoed without waiting for the
// cron schedule to fire.
remindersRouter.post('/run', requireRole('admin'), async (req, res, next) => {
  try {
    const lineClient = createLineClient(process.env.LINE_CHANNEL_ACCESS_TOKEN);
    const results = await checkAndSendReminders(pool, lineClient);
    res.json({ dryRun: lineClient.dryRun, results });
  } catch (err) {
    next(err);
  }
});
