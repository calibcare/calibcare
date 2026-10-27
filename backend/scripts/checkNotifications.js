import 'dotenv/config';
import { pool } from '../src/db.js';
import { createLineClient } from '../src/services/lineClient.js';
import { checkAndSendReminders } from '../src/services/reminderService.js';

/**
 * Standalone entry point for a Railway Cron Job service -- runs one
 * calibration reminder check and exits, instead of the long-running
 * node-cron scheduler the main Express app used to start on boot.
 *
 * Deliberately reuses checkAndSendReminders() (the same tested logic behind
 * POST /api/reminders/run and the old in-process scheduler) rather than
 * reimplementing the due-date matching here -- that function already
 * encodes the 30/7/1-day buckets, the catch-up-on-a-missed-
 * run behavior, and the notification_log dedup fix (a real bug found and
 * fixed in this project: a failed send must not permanently block retries).
 * Re-deriving that logic in a second place would risk losing those fixes.
 */
async function main() {
  const lineClient = createLineClient(process.env.LINE_CHANNEL_ACCESS_TOKEN);
  console.log(`[checkNotifications] starting (${new Date().toISOString()}), dryRun=${lineClient.dryRun}`);

  const results = await checkAndSendReminders(pool, lineClient);

  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`[checkNotifications] evaluated ${results.length} item(s) -- sent: ${sent}, failed: ${failed}, skipped: ${skipped}`);

  if (failed > 0) {
    console.error('[checkNotifications] one or more sends failed:', results.filter((r) => r.status === 'failed'));
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('[checkNotifications] fatal error:', err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
