import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDssMatch, findClosestMatch, describeClosestMatch, groupNotSuitable } from '../src/services/dssMatcher.js';

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

test('unit synonyms (amp/a) are treated as the same unit, not a mismatch', () => {
  const equipmentCurrent = {
    equipment: { name: 'Current Probe', model: 'CP1', serial_number: 'C1' },
    capabilities: [{ measurement_purpose: 'Equipment Current', measurement_range: '0-20a' }],
  };
  const requirements = [{ measurement_purpose: 'Equipment Current', min: 0, max: 15, unit: 'amp' }];
  const { suitable, notSuitable } = runDssMatch([equipmentCurrent], requirements);
  assert.equal(suitable.length, 1);
  assert.equal(notSuitable.length, 0);
});

test('each failure type carries the matching machine-readable reasonCode', () => {
  const requirements = [{ measurement_purpose: 'Oxygen', min: 0, max: 100, unit: '%' }];
  const { notSuitable: missing } = runDssMatch([pressureCalibrator], requirements);
  assert.equal(missing[0].results[0].reasonCode, 'missing_capability');

  const { notSuitable: unitMismatch } = runDssMatch([citrexH5], [{ measurement_purpose: 'Flow', min: 0, max: 180, unit: 'slpm' }]);
  assert.equal(unitMismatch[0].results[0].reasonCode, 'unit_mismatch');

  const { notSuitable: tooNarrow } = runDssMatch([pressureCalibrator], [{ measurement_purpose: 'Pressure', min: 0, max: 45, unit: 'psi' }]);
  const result = tooNarrow[0].results[0];
  assert.equal(result.reasonCode, 'range_too_narrow');
  assert.equal(result.shortfall.max, 15); // required 45, equipment maxes at 30
  assert.equal(result.shortfall.min, null);
});

test('findClosestMatch picks the smallest-shortfall equipment and ignores missing-capability/unit-mismatch failures', () => {
  const closeButNarrow = {
    equipment: { name: 'Close', model: 'C', serial_number: 'C1' },
    capabilities: [{ measurement_purpose: 'Pressure', measurement_range: '0-90 psi' }],
  };
  const farNarrow = {
    equipment: { name: 'Far', model: 'F', serial_number: 'F1' },
    capabilities: [{ measurement_purpose: 'Pressure', measurement_range: '0-10 psi' }],
  };
  const noCapability = {
    equipment: { name: 'NoCap', model: 'N', serial_number: 'N1' },
    capabilities: [],
  };
  const requirements = [{ measurement_purpose: 'Pressure', min: 0, max: 100, unit: 'psi' }];
  const { notSuitable, closestMatch } = runDssMatch([closeButNarrow, farNarrow, noCapability], requirements);
  assert.equal(notSuitable.length, 3);
  assert.equal(closestMatch.equipment.model, 'C'); // short by 10, not 90 -- and not the no-capability equipment

  const summary = describeClosestMatch(closestMatch);
  assert.match(summary, /Covers up to 90 psi/);
  assert.match(summary, /short by 10psi/);
});

test('findClosestMatch returns null when nothing fails purely on range', () => {
  const closestMatch = findClosestMatch([{ results: [{ pass: false, reasonCode: 'unit_mismatch' }], suitable: false }]);
  assert.equal(closestMatch, null);
});

test('groupNotSuitable groups equipment by shared failure reason, largest group first', () => {
  const narrowA = {
    equipment: { name: 'A', model: 'A', serial_number: 'A1' },
    capabilities: [{ measurement_purpose: 'Pressure', measurement_range: '0-10 psi' }],
  };
  const narrowB = {
    equipment: { name: 'B', model: 'B', serial_number: 'B1' },
    capabilities: [{ measurement_purpose: 'Pressure', measurement_range: '0-10 psi' }],
  };
  const missingCap = {
    equipment: { name: 'C', model: 'C', serial_number: 'C1' },
    capabilities: [],
  };
  const requirements = [{ measurement_purpose: 'Pressure', min: 0, max: 100, unit: 'psi' }];
  const { notSuitableGrouped } = runDssMatch([narrowA, narrowB, missingCap], requirements);

  assert.equal(notSuitableGrouped.length, 2);
  assert.equal(notSuitableGrouped[0].equipment.length, 2); // the two range_too_narrow equipment, grouped together
  assert.equal(notSuitableGrouped[0].reasonCode, 'range_too_narrow');
  assert.match(notSuitableGrouped[0].label, /Max range below 100psi required/);
  assert.equal(notSuitableGrouped[1].equipment.length, 1);
  assert.equal(notSuitableGrouped[1].reasonCode, 'missing_capability');
});
