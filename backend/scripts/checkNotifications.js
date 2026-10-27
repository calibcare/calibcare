import 'dotenv/config';
import { pool } from '../src/db.js';
import { createLineClient } from '../src/services/lineClient.js';
import { createEmailClient } from '../src/services/emailService.js';
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
  const emailClient = createEmailClient();
  console.log(
    `[checkNotifications] starting (${new Date().toISOString()}), lineDryRun=${lineClient.dryRun}, emailDryRun=${emailClient.dryRun}`
  );

  const results = await checkAndSendReminders(pool, lineClient, emailClient);

  // Each result carries one entry per channel its rule has turned on.
  const channels = results.flatMap((r) => r.channels || []);
  const sent = channels.filter((c) => c.status === 'sent').length;
  const failed = channels.filter((c) => c.status === 'failed');
  const skipped = results.filter((r) => r.skipped).length + channels.filter((c) => c.skipped).length;
  console.log(
    `[checkNotifications] evaluated ${results.length} item(s) -- channel sends: ${sent} sent, ${failed.length} failed, ${skipped} skipped`
  );

  if (failed.length > 0) {
    console.error('[checkNotifications] one or more sends failed:', results.filter((r) => (r.channels || []).some((c) => c.status === 'failed')));
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
