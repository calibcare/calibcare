import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSITIONS, DEFAULT_POSITION_KEY, getPosition, hasCapability, canManageAccount } from '../src/services/positions.js';

test('positions are ranked 1..5 with no gaps or ties, most senior first', () => {
  assert.equal(POSITIONS.length, 5);
  assert.deepEqual(
    POSITIONS.map((p) => p.rank),
    [1, 2, 3, 4, 5]
  );
  assert.equal(POSITIONS[0].key, 'deputy_manager');
  assert.equal(POSITIONS[4].key, 'specialist_2');
});

test('exactly Deputy Manager and Senior Specialist can edit', () => {
  const editors = POSITIONS.filter((p) => p.canEdit).map((p) => p.key);
  assert.deepEqual(editors, ['deputy_manager', 'senior_specialist']);
});

test('only the Deputy Manager can run reminders and assign positions', () => {
  const runners = POSITIONS.filter((p) => p.canRunReminders).map((p) => p.key);
  assert.deepEqual(runners, ['deputy_manager']);
});

test('the three Specialist levels are view-only', () => {
  for (const key of ['specialist_1_pm', 'specialist_1', 'specialist_2']) {
    assert.equal(hasCapability(key, 'canEdit'), false, `${key} must not be able to edit`);
    assert.equal(hasCapability(key, 'canRunReminders'), false, `${key} must not be able to run reminders`);
  }
});

test('new accounts default to the most junior position', () => {
  const mostJunior = POSITIONS.reduce((a, b) => (a.rank > b.rank ? a : b));
  assert.equal(DEFAULT_POSITION_KEY, mostJunior.key);
  assert.equal(hasCapability(DEFAULT_POSITION_KEY, 'canEdit'), false);
});

test('an unknown position grants nothing rather than throwing', () => {
  // Guards the migration window: a token or row carrying a retired role
  // string like "admin" must fail closed, not crash or slip through.
  assert.equal(getPosition('admin'), null);
  assert.equal(hasCapability('admin', 'canEdit'), false);
  assert.equal(hasCapability(undefined, 'canEdit'), false);
});

test('canManageAccount: Deputy Manager can help anyone, including another Deputy Manager', () => {
  for (const p of POSITIONS) assert.equal(canManageAccount('deputy_manager', p.key), true, p.key);
});

test('canManageAccount: Senior Specialist only manages strictly junior positions', () => {
  assert.equal(canManageAccount('senior_specialist', 'deputy_manager'), false);
  assert.equal(canManageAccount('senior_specialist', 'senior_specialist'), false);
  assert.equal(canManageAccount('senior_specialist', 'specialist_1_pm'), true);
  assert.equal(canManageAccount('senior_specialist', 'specialist_2'), true);
});

test('canManageAccount: positions without canEdit manage nobody', () => {
  for (const actor of ['specialist_1_pm', 'specialist_1', 'specialist_2']) {
    for (const p of POSITIONS) assert.equal(canManageAccount(actor, p.key), false, `${actor} -> ${p.key}`);
  }
  assert.equal(canManageAccount('nonsense', 'specialist_2'), false);
});
