/**
 * Given days-until-due, picks the single most urgent reminder bucket that
 * currently applies. Using "<=" thresholds (not exact equality) means a
 * missed cron run (e.g. server down for a day) still lands in a bucket next
 * time it runs, instead of silently skipping that equipment's reminder.
 */
export function pickBucket(daysUntilDue) {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'due';
  if (daysUntilDue <= 7) return '7_days';
  if (daysUntilDue <= 14) return '14_days';
  if (daysUntilDue <= 30) return '30_days';
  return null;
}

const BUCKET_LABEL = {
  overdue: 'is OVERDUE for calibration',
  due: 'is due for calibration TODAY',
  '7_days': 'is due for calibration in 7 days or less',
  '14_days': 'is due for calibration in 14 days or less',
  '30_days': 'is due for calibration in 30 days or less',
};

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function buildMessage(equipment, bucket, nextCalibrationDate) {
  return `[CalibCare] ${equipment.name} (${equipment.model}, S/N ${equipment.serial_number}) ${BUCKET_LABEL[bucket]}. Next calibration date: ${formatDate(nextCalibrationDate)}.`;
}

/**
 * db: an object with an async query(sql, params) method (mysql2 pool-shaped).
 * lineClient: from createLineClient() -- real or dry-run.
 * today: injectable for tests; defaults to now.
 *
 * Returns a summary of what was evaluated/sent, for logging or an API response.
 */
export async function checkAndSendReminders(db, lineClient, today = new Date()) {
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

  const [recipients] = await db.query(
    'SELECT user_id, line_user_id FROM users WHERE line_user_id IS NOT NULL AND line_user_id != ""'
  );

  const results = [];

  for (const row of dueRows) {
    const bucket = pickBucket(row.days_until_due);
    if (!bucket) continue;

    // Only a successful send counts as "already notified" -- a logged
    // 'failed' row (e.g. a rejected LINE API call) must not permanently
    // block retries, the same reasoning that already keeps dry-run sends
    // out of this table entirely (see below).
    const [already] = await db.query(
      "SELECT 1 FROM notification_log WHERE calibration_id = ? AND notification_type = ? AND status = 'sent' LIMIT 1",
      [row.calibration_id, bucket]
    );
    if (already.length > 0) {
      results.push({ equipment: row.name, serial_number: row.serial_number, bucket, skipped: 'already notified' });
      continue;
    }

    if (recipients.length === 0) {
      results.push({ equipment: row.name, serial_number: row.serial_number, bucket, skipped: 'no recipients with a line_user_id' });
      continue;
    }

    const equipment = { name: row.name, model: row.model, serial_number: row.serial_number };
    const message = buildMessage(equipment, bucket, row.next_calibration_date);
    const userIds = recipients.map((r) => r.line_user_id);
    const sendResult = await lineClient.multicast(userIds, message);
    const status = sendResult.ok ? 'sent' : 'failed';

    // Dry-run "sends" are never logged: the (calibration_id, bucket) dedup
    // check above only looks at whether a row exists, so if a dry-run send
    // were logged as 'sent', the real reminder would silently never fire
    // once a real LINE_CHANNEL_ACCESS_TOKEN is configured. Leaving no row
    // behind means the same item keeps showing up in dry-run results every
    // day until it's actually sent for real.
    if (!lineClient.dryRun) {
      for (const recipient of recipients) {
        await db.query(
          'INSERT INTO notification_log (calibration_id, user_id, notification_type, channel, status) VALUES (?, ?, ?, ?, ?)',
          [row.calibration_id, recipient.user_id, bucket, 'LINE', status]
        );
      }
    }

    results.push({
      equipment: row.name,
      serial_number: row.serial_number,
      bucket,
      notified: recipients.length,
      status,
      dryRun: Boolean(lineClient.dryRun),
      message,
    });
  }

  return results;
}
