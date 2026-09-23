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

const DEFAULT_RULES = ['30_days', '14_days', '7_days', 'due', 'overdue'].map((bucket) => ({
  bucket,
  enabled: 1,
  send_line: 1,
  send_email: 0,
}));

// A stateful mock: notification_log rows persist across calls (in `log`),
// and the dedup lookup below re-implements the *same* channel + status
// filter the real SQL uses, driven by whether the production query string
// actually contains "status = 'sent'" -- so a test can't pass just because
// the mock assumed the right behavior independently of the real query.
function makeFakeDb({ dueRows, recipients = [], emailRecipients = [], rules = DEFAULT_RULES, seedLog = [] }) {
  const log = [...seedLog]; // { calibration_id, user_id, notification_type, channel, status }
  const inserts = [];
  const db = {
    async query(sql, params) {
      if (sql.includes('FROM calibration_history ch')) {
        return [dueRows];
      }
      if (sql.includes('FROM reminder_rule')) {
        return [rules];
      }
      if (sql.includes('FROM users WHERE line_user_id')) {
        return [recipients];
      }
      if (sql.includes('FROM users WHERE email_verified')) {
        return [emailRecipients];
      }
      if (sql.includes('FROM notification_log WHERE calibration_id')) {
        const [calibrationId, bucket, channel] = params;
        const onlySent = sql.includes("status = 'sent'");
        const hit = log.some(
          (r) =>
            r.calibration_id === calibrationId &&
            r.notification_type === bucket &&
            r.channel === channel &&
            (!onlySent || r.status === 'sent')
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

const fakeEmailClient = ({ dryRun = false, fail = false } = {}) => {
  const calls = [];
  return {
    dryRun,
    calls,
    async send(to, subject, text) {
      calls.push({ to, subject, text });
      return fail ? { ok: false } : { ok: true, dryRun };
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
  assert.equal(results[0].channels.length, 1);
  assert.equal(results[0].channels[0].channel, 'LINE');
  assert.equal(results[0].channels[0].status, 'sent');
  assert.equal(line.calls.length, 1);
  assert.deepEqual(line.calls[0].userIds, ['Uabc123']);
  assert.match(line.calls[0].text, /Vital Signs Simulator/);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][2], '7_days'); // notification_type param
  assert.equal(inserts[0][3], 'LINE'); // channel param
});

test('a disabled rule is skipped entirely, no send attempted on any channel', async () => {
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
  const rules = DEFAULT_RULES.map((r) => (r.bucket === 'overdue' ? { ...r, enabled: 0 } : r));
  const { db } = makeFakeDb({ dueRows, recipients, rules });
  const line = fakeLineClient();

  const results = await checkAndSendReminders(db, line);

  assert.equal(results[0].skipped, 'rule disabled');
  assert.equal(results[0].channels, undefined);
  assert.equal(line.calls.length, 0);
});

test('a rule with both channels enabled sends LINE and email, logging one row per channel per recipient', async () => {
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
  const recipients = [{ user_id: 1, line_user_id: 'Uabc123' }];
  const emailRecipients = [{ user_id: 1, email: 'a@idsmed.com' }, { user_id: 2, email: 'b@idsmed.com' }];
  const rules = DEFAULT_RULES.map((r) => (r.bucket === 'due' ? { ...r, send_email: 1 } : r));
  const { db, inserts } = makeFakeDb({ dueRows, recipients, emailRecipients, rules });
  const line = fakeLineClient();
  const email = fakeEmailClient();

  const results = await checkAndSendReminders(db, line, email);

  assert.equal(results[0].channels.length, 2);
  const lineResult = results[0].channels.find((c) => c.channel === 'LINE');
  const emailResult = results[0].channels.find((c) => c.channel === 'EMAIL');
  assert.equal(lineResult.status, 'sent');
  assert.equal(emailResult.status, 'sent');
  assert.equal(emailResult.notified, 2);
  assert.equal(email.calls.length, 2);
  assert.match(email.calls[0].subject, /kVp Meter/);
  // 1 LINE row + 2 EMAIL rows (one per recipient)
  assert.equal(inserts.filter((i) => i[3] === 'LINE').length, 1);
  assert.equal(inserts.filter((i) => i[3] === 'EMAIL').length, 2);
});

test('per-channel dedup: LINE already sent does not block a first-time email attempt for the same bucket', async () => {
  const dueRows = [
    {
      calibration_id: 4,
      equipment_id: 13,
      next_calibration_date: '2026-07-14',
      name: 'kVp Meter',
      model: 'Piranha 557',
      serial_number: 'CB2-14060199',
      days_until_due: 0,
    },
  ];
  const recipients = [{ user_id: 1, line_user_id: 'Uabc123' }];
  const emailRecipients = [{ user_id: 1, email: 'a@idsmed.com' }];
  const rules = DEFAULT_RULES.map((r) => (r.bucket === 'due' ? { ...r, send_email: 1 } : r));
  const seedLog = [{ calibration_id: 4, user_id: 1, notification_type: 'due', channel: 'LINE', status: 'sent' }];
  const { db } = makeFakeDb({ dueRows, recipients, emailRecipients, rules, seedLog });
  const line = fakeLineClient();
  const email = fakeEmailClient();

  const results = await checkAndSendReminders(db, line, email);

  const lineResult = results[0].channels.find((c) => c.channel === 'LINE');
  const emailResult = results[0].channels.find((c) => c.channel === 'EMAIL');
  assert.equal(lineResult.skipped, 'already notified');
  assert.equal(emailResult.status, 'sent');
  assert.equal(line.calls.length, 0);
  assert.equal(email.calls.length, 1);
});

test('email dry-run never makes a real send and is not logged', async () => {
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
  const emailRecipients = [{ user_id: 1, email: 'a@idsmed.com' }];
  const rules = DEFAULT_RULES.map((r) => (r.bucket === 'due' ? { ...r, send_line: 0, send_email: 1 } : r));
  const { db, inserts } = makeFakeDb({ dueRows, emailRecipients, rules });
  const line = fakeLineClient();
  const email = fakeEmailClient({ dryRun: true });

  const results = await checkAndSendReminders(db, line, email);

  const emailResult = results[0].channels.find((c) => c.channel === 'EMAIL');
  assert.equal(emailResult.dryRun, true);
  assert.equal(emailResult.status, 'sent');
  assert.equal(email.calls.length, 1);
  assert.equal(inserts.length, 0);
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
  const seedLog = [{ calibration_id: 2, user_id: 1, notification_type: 'overdue', channel: 'LINE', status: 'failed' }];
  const { db } = makeFakeDb({ dueRows, recipients, seedLog });
  const line = fakeLineClient();

  const results = await checkAndSendReminders(db, line);

  const lineResult = results[0].channels.find((c) => c.channel === 'LINE');
  assert.equal(lineResult.skipped, undefined);
  assert.equal(lineResult.status, 'sent');
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

  const lineResult = results[0].channels.find((c) => c.channel === 'LINE');
  assert.equal(lineResult.skipped, 'no recipients with a line_user_id');
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
  const lineResult = results[0].channels.find((c) => c.channel === 'LINE');
  assert.equal(dryRunCalled, true);
  assert.equal(lineResult.dryRun, true);
  assert.equal(lineResult.status, 'sent');
  // Dry-run must NOT write to notification_log -- otherwise the dedup check
  // would permanently block the real reminder once LINE is configured for real.
  assert.equal(inserts.length, 0);
});
