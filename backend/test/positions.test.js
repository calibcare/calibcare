import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSITIONS, DEFAULT_POSITION_KEY, getPosition, hasCapability, canManageAccount, canAssignPosition } from '../src/services/positions.js';

test('positions are ranked 1..6 with no gaps or ties, most senior first', () => {
  assert.equal(POSITIONS.length, 6);
  assert.deepEqual(
    POSITIONS.map((p) => p.rank),
    [1, 2, 3, 4, 5, 6]
  );
  assert.equal(POSITIONS[0].key, 'owner');
  assert.equal(POSITIONS[1].key, 'deputy_manager');
  assert.equal(POSITIONS[5].key, 'specialist_2');
});

test('exactly System Owner, Deputy Manager and Senior Specialist can edit', () => {
  const editors = POSITIONS.filter((p) => p.canEdit).map((p) => p.key);
  assert.deepEqual(editors, ['owner', 'deputy_manager', 'senior_specialist']);
});

test('only the System Owner and Deputy Manager can run reminders and assign positions', () => {
  const runners = POSITIONS.filter((p) => p.canRunReminders).map((p) => p.key);
  assert.deepEqual(runners, ['owner', 'deputy_manager']);
});

test('only the System Owner can manage the Owner position', () => {
  const owners = POSITIONS.filter((p) => p.canManageOwner).map((p) => p.key);
  assert.deepEqual(owners, ['owner']);
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

test('canManageAccount: System Owner can help anyone', () => {
  for (const p of POSITIONS) assert.equal(canManageAccount('owner', p.key), true, p.key);
});

test('canManageAccount: Deputy Manager can help anyone except the System Owner', () => {
  assert.equal(canManageAccount('deputy_manager', 'owner'), false);
  for (const p of POSITIONS.filter((p) => p.key !== 'owner')) {
    assert.equal(canManageAccount('deputy_manager', p.key), true, p.key);
  }
});

test('canAssignPosition: only the System Owner can give or take away the Owner position', () => {
  assert.equal(canAssignPosition('owner', 'deputy_manager', 'owner'), true);
  assert.equal(canAssignPosition('owner', 'owner', 'deputy_manager'), true);
  assert.equal(canAssignPosition('deputy_manager', 'specialist_2', 'owner'), false);
  assert.equal(canAssignPosition('deputy_manager', 'owner', 'specialist_2'), false);
  assert.equal(canAssignPosition('deputy_manager', 'specialist_2', 'senior_specialist'), true);
  assert.equal(canAssignPosition('deputy_manager', 'deputy_manager', 'specialist_2'), true);
});

test('canAssignPosition: positions without canRunReminders assign nothing', () => {
  assert.equal(canAssignPosition('senior_specialist', 'specialist_2', 'specialist_1'), false);
  assert.equal(canAssignPosition('specialist_2', 'specialist_2', 'specialist_1'), false);
  assert.equal(canAssignPosition('owner', 'specialist_2', 'nonsense'), false);
});

test('canManageAccount: Senior Specialist only manages strictly junior positions', () => {
  assert.equal(canManageAccount('senior_specialist', 'owner'), false);
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
