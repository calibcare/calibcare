import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegisterWorkbook, statusText } from '../src/services/registerExport.js';

function makeFakeDb({ equipment, capabilities, calibrations }) {
  return {
    async query(sql) {
      if (sql.includes('FROM equipment_capability')) return [capabilities];
      if (sql.includes('FROM calibration_history')) return [calibrations];
      if (sql.includes('FROM equipment')) return [equipment];
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

test('statusText keeps the original note only while it matches the current status', () => {
  assert.equal(statusText('decommissioned', 'ยกเลิกการใช้งาน 1/25'), 'ยกเลิกการใช้งาน 1/25');
  assert.equal(statusText('under_maintenance', 'ชำรุด 14/10/2026'), 'ชำรุด 14/10/2026');
  // sent out in August, calibration since recorded -> back in service
  assert.equal(statusText('active', 'ส่งสอบเทียบ Aug 2026'), 'ปกติ');
  assert.equal(statusText('sent_for_calibration', null), 'ส่งสอบเทียบ');
  assert.equal(statusText('active', null), 'ปกติ');
});

test('one block per instrument, one row per capability, with the latest calibration', async () => {
  const db = makeFakeDb({
    equipment: [
      { equipment_id: 1, equipment_no: 1, name: 'kVp Meter', model: 'Piranha 557', serial_number: 'CB2', location: 'Head office', status: 'active', status_note: 'ส่งสอบเทียบ Aug 2026', remarks: null },
      { equipment_id: 2, equipment_no: 2, name: 'Gauge', model: null, serial_number: 'AE969', location: 'Head office', status: 'decommissioned', status_note: 'ยกเลิกการใช้งาน 1/25', remarks: 'old' },
    ],
    capabilities: [
      { capability_id: 1, equipment_id: 1, measurement_purpose: 'kVp', measurement_range: '35-160kVp' },
      { capability_id: 2, equipment_id: 1, measurement_purpose: 'Exposure Time', measurement_range: '0.1ms-2000s' },
    ],
    calibrations: [
      // newest first, as the query orders them
      { calibration_id: 9, equipment_id: 1, responsible_person: 'Service admin', calibration_frequency: '1 ปี', calibration_date: '2026-10-20', next_calibration_date: '2027-10-20', certificate_filename: 'cert.pdf' },
      { calibration_id: 3, equipment_id: 1, responsible_person: 'Service admin', calibration_frequency: '1 ปี', calibration_date: '2025-10-20', next_calibration_date: '2026-10-20' },
    ],
  });

  const { workbook, filename, counts } = await buildRegisterWorkbook(db, new Date('2026-10-29T03:00:00Z'));
  assert.equal(filename, 'FP-ENG-05-01_CalibCare_2026-10-29.xlsx');
  assert.deepEqual(counts, { equipment: 2, capabilities: 2, calibrations: 2 });

  const ws = workbook.getWorksheet('FP-ENG-05-01 rev.02');
  assert.equal(ws.getCell('A4').value, 'เลขที่');
  assert.equal(ws.getCell('P4').value, 'หมายเหตุ');

  // instrument 1: two capability rows, both carrying the newest calibration
  assert.equal(ws.getCell('A5').value, 1);
  assert.equal(ws.getCell('E5').value, 'kVp');
  assert.equal(ws.getCell('E6').value, 'Exposure Time');
  assert.equal(ws.getCell('D6').value, 'CB2');
  assert.equal(ws.getCell('L5').value.toISOString().slice(0, 10), '2026-10-20');
  assert.equal(ws.getCell('M6').value.toISOString().slice(0, 10), '2027-10-20');
  assert.equal(ws.getCell('O5').value, 'ปกติ');
  assert.ok(ws.getCell('O6').isMerged);

  // instrument 2: no capabilities, no calibration -> one row, empty dates
  assert.equal(ws.getCell('A7').value, 2);
  assert.equal(ws.getCell('L7').value, null);
  assert.equal(ws.getCell('O7').value, 'ยกเลิกการใช้งาน 1/25');

  const hist = workbook.getWorksheet('ประวัติการสอบเทียบ');
  assert.equal(hist.rowCount, 3); // header + 2 calibrations
  assert.equal(hist.getCell('G2').value, 'cert.pdf');
});
