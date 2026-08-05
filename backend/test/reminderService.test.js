import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBucket, checkAndSendReminders } from '../src/services/reminderService.js';

test('pickBucket picks the most urgent applicable threshold', () => {
  assert.equal(pickBucket(-5), 'overdue');
  assert.equal(pickBucket(0), 'due');
  assert.equal(pickBucket(5), '7_days');
  assert.equal(pickBucket(10), '14_days');
  assert.equal(pickBucket(25), '30_days');
  assert.equal(pickBucket(40), null);
});

// A stateful mock: notification_log rows persist across calls (in `log`),
// and the dedup lookup below re-implements the *same* status filter the
// real SQL uses, driven by whether the production query string actually
// contains "status = 'sent'" -- so a test can't pass just because the mock
// assumed the right behavior independently of the real query.
function makeFakeDb({ dueRows, recipients, seedLog = [] }) {
  const log = [...seedLog]; // { calibration_id, user_id, notification_type, status }
  const inserts = [];
  const db = {
    async query(sql, params) {
      if (sql.includes('FROM calibration_history ch')) {
        return [dueRows];
      }
      if (sql.includes('FROM users WHERE line_user_id')) {
        return [recipients];
      }
      if (sql.includes('FROM notification_log WHERE calibration_id')) {
        const [calibrationId, bucket] = params;
        const onlySent = sql.includes("status = 'sent'");
        const hit = log.some(
          (r) => r.calibration_id === calibrationId && r.notification_type === bucket && (!onlySent || r.status === 'sent')
        );
        return [hit ? [{ 1: 1 }] : []];
      }
      if (sql.startsWith('INSERT INTO notification_log')) {
        const [calibration_id, user_id, notification_type, channel, status] = params;
        log.push({ calibration_id, user_id, notification_type, channel, status });
        inserts.push(params);
        return [{ insertId: inserts.length }];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  return { db, inserts, log };
}

const fakeLineClient = () => {
  const calls = [];
  return {
    dryRun: false,
    calls,
    async multicast(userIds, text) {
      calls.push({ userIds, text });
      return { ok: true };
    },
  };
};

test('sends a reminder and logs it when an item is due and recipients exist', async () => {
  const dueRows = [
    {
      calibration_id: 1,
      equipment_id: 10,
      next_calibration_date: '2026-07-16',
      name: 'Vital Signs Simulator',
      model: 'Prosim8',
      serial_number: '5019606',
      days_until_due: 2,
    },
  ];
  const recipients = [{ user_id: 1, line_user_id: 'Uabc123' }];
  const { db, inserts } = makeFakeDb({ dueRows, recipients });
  const line = fakeLineClient();

  const results = await checkAndSendReminders(db, line);

  assert.equal(results.length, 1);
  assert.equal(results[0].bucket, '7_days');
  assert.equal(results[0].status, 'sent');
  assert.equal(line.calls.length, 1);
  assert.deepEqual(line.calls[0].userIds, ['Uabc123']);
  assert.match(line.calls[0].text, /Vital Signs Simulator/);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][2], '7_days'); // notification_type param
});

test('skips an item that was already notified for the same bucket', async () => {
  const dueRows = [
    {
      calibration_id: 2,
      equipment_id: 11,
      next_calibration_date: '2026-06-20',
      name: 'Electrical Safety Analyzer',
      model: 'ESA612',
      serial_number: '5040062',
      days_until_due: -24,
    },
  ];
  const recipients = [{ user_id: 1, line_user_id: 'Uabc123' }];
  const seedLog = [{ calibration_id: 2, user_id: 1, notification_type: 'overdue', status: 'sent' }];
  const { db } = makeFakeDb({ dueRows, recipients, seedLog });
  const line = fakeLineClient();

  const results = await checkAndSendReminders(db, line);

  assert.equal(results[0].skipped, 'already notified');
  assert.equal(line.calls.length, 0);
});

test('a previously failed send does not permanently block a retry', async () => {
  const dueRows = [
    {
      calibration_id: 2,
      equipment_id: 11,
      next_calibration_date: '2026-06-20',
      name: 'Electrical Safety Analyzer',
      model: 'ESA612',
      serial_number: '5040062',
      days_until_due: -24,
    },
  ];
  const recipients = [{ user_id: 1, line_user_id: 'Uabc123' }];
  // Simulate exactly what happened live: an earlier run logged a 'failed'
  // row (e.g. LINE rejected an invalid recipient in the batch) for this
  // same calibration_id + bucket.
  const seedLog = [{ calibration_id: 2, user_id: 1, notification_type: 'overdue', status: 'failed' }];
  const { db } = makeFakeDb({ dueRows, recipients, seedLog });
  const line = fakeLineClient();

  const results = await checkAndSendReminders(db, line);

  assert.equal(results[0].skipped, undefined);
  assert.equal(results[0].status, 'sent');
  assert.equal(line.calls.length, 1);
});

test('skips sending when there are no recipients with a line_user_id', async () => {
  const dueRows = [
    {
      calibration_id: 3,
      equipment_id: 12,
      next_calibration_date: '2026-07-14',
      name: 'kVp Meter',
      model: 'Piranha 557',
      serial_number: 'CB2-14060199',
      days_until_due: 0,
    },
  ];
  const { db } = makeFakeDb({ dueRows, recipients: [] });
  const line = fakeLineClient();

  const results = await checkAndSendReminders(db, line);

  assert.equal(results[0].skipped, 'no recipients with a line_user_id');
  assert.equal(line.calls.length, 0);
});

test('items further than 30 days out produce no reminder', async () => {
  const dueRows = [
    {
      calibration_id: 4,
      equipment_id: 13,
      next_calibration_date: '2027-01-01',
      name: 'Steel Weight',
      model: 'Class M1',
      serial_number: 'X',
      days_until_due: 170,
    },
  ];
  const { db } = makeFakeDb({ dueRows, recipients: [{ user_id: 1, line_user_id: 'U1' }] });
  const line = fakeLineClient();

  const results = await checkAndSendReminders(db, line);
  assert.equal(results.length, 0);
});

test('dry-run LINE client never makes a real send but still gets called', async () => {
  const dueRows = [
    {
      calibration_id: 5,
      equipment_id: 14,
      next_calibration_date: '2026-07-14',
      name: 'kVp Meter',
      model: 'Piranha 557',
      serial_number: 'CB2-14060199',
      days_until_due: 0,
    },
  ];
  const recipients = [{ user_id: 1, line_user_id: 'Uabc123' }];
  const { db, inserts } = makeFakeDb({ dueRows, recipients });

  let dryRunCalled = false;
  const dryClient = {
    dryRun: true,
    async multicast() {
      dryRunCalled = true;
      return { ok: true, dryRun: true };
    },
  };

  const results = await checkAndSendReminders(db, dryClient);
  assert.equal(dryRunCalled, true);
  assert.equal(results[0].dryRun, true);
  assert.equal(results[0].status, 'sent');
  // Dry-run must NOT write to notification_log -- otherwise the dedup check
  // would permanently block the real reminder once LINE is configured for real.
  assert.equal(inserts.length, 0);
});
