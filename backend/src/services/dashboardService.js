import { pickBucket } from './reminderService.js';

/**
 * Aggregates equipment data for the monitoring dashboard (Objective 3):
 * total count, breakdown by status/category/manufacturer, and equipment
 * approaching or past its calibration due date.
 *
 * Reuses pickBucket() from reminderService so "what counts as due soon vs
 * overdue" is defined in exactly one place and can't drift between the
 * dashboard and the reminder scheduler.
 */
// "Today" is the team's calendar date in Thailand, not UTC: the server runs
// on UTC, so toISOString() would still say "yesterday" until 07:00 Thai
// time and count a device due yesterday as due today, not overdue.
const THAI_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });

export async function getDashboardSummary(db, today = new Date()) {
  const todayStr = THAI_DATE.format(today);

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM equipment');

  const [byStatus] = await db.query('SELECT status, COUNT(*) AS count FROM equipment GROUP BY status');

  const [byCategory] = await db.query(
    `SELECT COALESCE(NULLIF(category, ''), name) AS category, COUNT(*) AS count
     FROM equipment
     GROUP BY COALESCE(NULLIF(category, ''), name)
     ORDER BY count DESC`
  );

  const [byManufacturer] = await db.query(
    `SELECT COALESCE(NULLIF(manufacturer, ''), 'Unknown') AS manufacturer, COUNT(*) AS count
     FROM equipment
     GROUP BY COALESCE(NULLIF(manufacturer, ''), 'Unknown')
     ORDER BY count DESC`
  );

  const [dueRows] = await db.query(
    `SELECT e.equipment_id, e.name, e.model, e.serial_number, e.status,
            ch.next_calibration_date,
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

  const overdue = [];
  const dueSoon = [];
  for (const row of dueRows) {
    const bucket = pickBucket(row.days_until_due);
    if (bucket === 'overdue') overdue.push({ ...row, bucket });
    else if (bucket) dueSoon.push({ ...row, bucket });
  }
  overdue.sort((a, b) => a.days_until_due - b.days_until_due);
  dueSoon.sort((a, b) => a.days_until_due - b.days_until_due);

  // Real calibration-due distribution for the next 6 months (incl. the
  // current one), built from the same dueRows query above -- not a
  // fabricated trend line, just that data grouped by month.
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, month: d.toLocaleString('en-US', { month: 'short' }) });
  }
  const countsByMonth = {};
  for (const row of dueRows) {
    const key = String(row.next_calibration_date).slice(0, 7);
    countsByMonth[key] = (countsByMonth[key] || 0) + 1;
  }
  const monthlySchedule = months.map(({ key, month }) => ({ month, count: countsByMonth[key] || 0 }));

  return {
    totalEquipment: total,
    byStatus,
    byCategory,
    byManufacturer,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    overdue,
    dueSoon,
    monthlySchedule,
  };
}
