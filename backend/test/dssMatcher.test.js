import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDssMatch } from '../src/services/dssMatcher.js';

// Real rows from the seeded mcems database.
const vt650 = {
  equipment: { name: 'Gas Flow Analyzer', model: 'VT650', serial_number: '5360407' },
  capabilities: [
    { measurement_purpose: 'Flow', measurement_range: '0 to ±200 slpm' },
    { measurement_purpose: 'Pressure', measurement_range: '-0.8 to 10 bar' },
    { measurement_purpose: 'Oxygen', measurement_range: '0 to 100 %' },
  ],
};

const citrexH5 = {
  equipment: { name: 'Gas Flow Analyzer', model: 'CITREX H5', serial_number: 'BB106272' },
  capabilities: [
    { measurement_purpose: 'Flow', measurement_range: '-300 to 300 l/min' },
  ],
};

const pressureCalibrator = {
  equipment: { name: 'Pressure Calibrator', model: 'Fluke-717 30G', serial_number: '3743662' },
  capabilities: [{ measurement_purpose: 'Pressure', measurement_range: '0-30 psi' }],
};

test('spec example: VT650 is suitable for Flow/Pressure/Oxygen requirement', () => {
  const requirements = [
    { measurement_purpose: 'Flow', min: 0, max: 180, unit: 'slpm' },
    { measurement_purpose: 'Pressure', min: 0, max: 8, unit: 'bar' },
    { measurement_purpose: 'Oxygen', min: 21, max: 100, unit: '%' },
  ];
  const { suitable, notSuitable } = runDssMatch([vt650], requirements);
  assert.equal(suitable.length, 1);
  assert.equal(notSuitable.length, 0);
  assert.equal(suitable[0].equipment.model, 'VT650');
  assert.ok(suitable[0].results.every((r) => r.pass));
});

test('unit mismatch is flagged, not silently passed or failed as out-of-range', () => {
  const requirements = [{ measurement_purpose: 'Flow', min: 0, max: 180, unit: 'slpm' }];
  const { notSuitable } = runDssMatch([citrexH5], requirements);
  assert.equal(notSuitable.length, 1);
  assert.match(notSuitable[0].results[0].reason, /Unit mismatch/);
});

test('out-of-range requirement produces a specific max/min reason', () => {
  const requirements = [{ measurement_purpose: 'Pressure', min: 0, max: 45, unit: 'psi' }];
  const { notSuitable } = runDssMatch([pressureCalibrator], requirements);
  assert.equal(notSuitable.length, 1);
  assert.match(notSuitable[0].results[0].reason, /Required max 45psi, equipment maximum is 30 psi/);
});

test('missing capability for a requested purpose fails cleanly', () => {
  const requirements = [{ measurement_purpose: 'Oxygen', min: 0, max: 100, unit: '%' }];
  const { notSuitable } = runDssMatch([pressureCalibrator], requirements);
  assert.equal(notSuitable.length, 1);
  assert.match(notSuitable[0].results[0].reason, /no recorded capability/);
});

test('ranking prefers the tighter-fitting equipment among multiple suitable options', () => {
  const wideRange = {
    equipment: { name: 'Wide', model: 'W', serial_number: 'W1' },
    capabilities: [{ measurement_purpose: 'Pressure', measurement_range: '0-1000 psi' }],
  };
  const tightRange = {
    equipment: { name: 'Tight', model: 'T', serial_number: 'T1' },
    capabilities: [{ measurement_purpose: 'Pressure', measurement_range: '0-50 psi' }],
  };
  const requirements = [{ measurement_purpose: 'Pressure', min: 0, max: 30, unit: 'psi' }];
  const { suitable } = runDssMatch([wideRange, tightRange], requirements);
  assert.equal(suitable.length, 2);
  assert.equal(suitable[0].equipment.model, 'T'); // tighter fit ranked first
});
