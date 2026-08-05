import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardSummary } from '../src/services/dashboardService.js';

function makeFakeDb({ total, byStatus, byCategory, byManufacturer, dueRows }) {
  return {
    async query(sql) {
      if (sql.includes('COUNT(*) AS total FROM equipment')) return [[{ total }]];
      if (sql.includes('GROUP BY status')) return [byStatus];
      if (sql.includes("COALESCE(NULLIF(category")) return [byCategory];
      if (sql.includes("COALESCE(NULLIF(manufacturer")) return [byManufacturer];
      if (sql.includes('FROM calibration_history ch')) return [dueRows];
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

test('passes through total, status, category, and manufacturer breakdowns', async () => {
  const db = makeFakeDb({
    total: 163,
    byStatus: [{ status: 'active', count: 126 }, { status: 'decommissioned', count: 30 }, { status: 'sent_for_calibration', count: 7 }],
    byCategory: [{ category: 'True RMS Multimeter', count: 20 }],
    byManufacturer: [{ manufacturer: 'Unknown', count: 163 }],
    dueRows: [],
  });

  const summary = await getDashboardSummary(db);

  assert.equal(summary.totalEquipment, 163);
  assert.deepEqual(summary.byStatus, [{ status: 'active', count: 126 }, { status: 'decommissioned', count: 30 }, { status: 'sent_for_calibration', count: 7 }]);
  assert.deepEqual(summary.byCategory, [{ category: 'True RMS Multimeter', count: 20 }]);
  assert.deepEqual(summary.byManufacturer, [{ manufacturer: 'Unknown', count: 163 }]);
});

test('splits due-date rows into overdue vs due-soon using pickBucket, sorted soonest-first', async () => {
  const dueRows = [
    { equipment_id: 1, name: 'A', model: 'M', serial_number: 'S1', status: 'active', next_calibration_date: '2027-01-01', days_until_due: 170 }, // > 30 days: excluded
    { equipment_id: 2, name: 'B', model: 'M', serial_number: 'S2', status: 'active', next_calibration_date: '2026-06-20', days_until_due: -24 }, // overdue
    { equipment_id: 3, name: 'C', model: 'M', serial_number: 'S3', status: 'active', next_calibration_date: '2026-07-16', days_until_due: 2 }, // 7_days
    { equipment_id: 4, name: 'D', model: 'M', serial_number: 'S4', status: 'active', next_calibration_date: '2026-06-10', days_until_due: -34 }, // more overdue
    { equipment_id: 5, name: 'E', model: 'M', serial_number: 'S5', status: 'active', next_calibration_date: '2026-08-01', days_until_due: 18 }, // 30_days
  ];
  const db = makeFakeDb({ total: 5, byStatus: [], byCategory: [], byManufacturer: [], dueRows });

  const summary = await getDashboardSummary(db);

  assert.equal(summary.overdueCount, 2);
  assert.equal(summary.dueSoonCount, 2);
  // soonest-first: -34 days before -24 days
  assert.deepEqual(summary.overdue.map((r) => r.equipment_id), [4, 2]);
  // soonest-first: 2 days before 18 days
  assert.deepEqual(summary.dueSoon.map((r) => r.equipment_id), [3, 5]);
  assert.equal(summary.overdue[0].bucket, 'overdue');
  assert.equal(summary.dueSoon[0].bucket, '7_days');
  assert.equal(summary.dueSoon[1].bucket, '30_days');
});

test('monthlySchedule buckets real next_calibration_date values into the next 6 months', async () => {
  const today = new Date(2026, 6, 15); // 2026-07-15 (local), month index 6 = July
  const dueRows = [
    { equipment_id: 1, next_calibration_date: '2026-07-20', days_until_due: 5 },
    { equipment_id: 2, next_calibration_date: '2026-07-25', days_until_due: 10 },
    { equipment_id: 3, next_calibration_date: '2026-08-01', days_until_due: 17 },
    { equipment_id: 4, next_calibration_date: '2026-12-31', days_until_due: 169 }, // outside the 6-month window (Jul-Dec is exactly 6, so this lands in Dec)
    { equipment_id: 5, next_calibration_date: '2027-06-01', days_until_due: 320 }, // well outside the window
  ];
  const db = makeFakeDb({ total: 5, byStatus: [], byCategory: [], byManufacturer: [], dueRows });

  const summary = await getDashboardSummary(db, today);

  assert.equal(summary.monthlySchedule.length, 6);
  assert.deepEqual(
    summary.monthlySchedule.map((m) => m.month),
    ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  );
  assert.equal(summary.monthlySchedule[0].count, 2); // July: rows 1 and 2
  assert.equal(summary.monthlySchedule[1].count, 1); // August: row 3
  assert.equal(summary.monthlySchedule[2].count, 0);
  assert.equal(summary.monthlySchedule[5].count, 1); // December: row 4
  // row 5 (2027-06) falls outside the 6-month window entirely -- total across
  // all buckets should be 4, not 5.
  const totalBucketed = summary.monthlySchedule.reduce((sum, m) => sum + m.count, 0);
  assert.equal(totalBucketed, 4);
});
