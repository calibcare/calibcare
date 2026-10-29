import ExcelJS from 'exceljs';

/**
 * Builds the equipment register as an Excel file in the same layout as the
 * company's paper form FP-ENG-05-01 Rev.02 (16 columns, one block of rows
 * per instrument, one row per measurement capability), filled from the live
 * database -- so a calibration recorded on the website shows up the next
 * time the file is downloaded.
 */

// Copied exactly from row 4 of the FP-ENG-05-01 register.
const HEADERS = [
  'เลขที่', 'ชื่อเครื่องมือวัด', 'รุ่นเครื่องมือวัด', 'หมายเลขเครื่อง', 'จุดประสงค์ที่ใช้วัด',
  'ช่วงในการวัดของเครื่องมือวัด', 'ค่าผิดพลาดของเครื่องมือวัด', 'ช่วงในการใช้งานของผลิตภัณฑ์',
  'เกณฑ์การยอมรับของผลิตภัณฑ์', 'ผู้รับผิดชอบ', 'ความถี่ในการสอบเทียบ', 'สอบเทียบครั้งล่าสุด',
  'สอบเทียบครั้งต่อไป', 'สถานที่', 'สถานะ', 'หมายเหตุ',
];
// Column widths of the original register.
const WIDTHS = [6, 22, 15, 20, 16, 16, 18, 16, 16, 13, 10, 13, 13, 18, 20, 22];
// Columns that describe the whole instrument, merged down its block.
const BLOCK_COLUMNS = [1, 2, 3, 14, 15, 16];

// The register's own words for each status, and how its free-text notes
// start (same mapping database/register_update/merge.py uses on import).
const STATUS_TEXT = {
  active: 'ปกติ',
  sent_for_calibration: 'ส่งสอบเทียบ',
  under_maintenance: 'ชำรุด',
  decommissioned: 'ยกเลิกการใช้งาน',
};
const NOTE_PREFIXES = {
  active: ['ปกติ'],
  sent_for_calibration: ['ส่งสอบเทียบ', 'ส่งแคล'],
  under_maintenance: ['ชำรุด'],
  decommissioned: ['ยกเลิกการใช้งาน'],
};

// The original note ("ยกเลิกการใช้งาน 1/25") carries a date the plain word
// doesn't, so it is kept -- but only while it still describes the current
// status. A device sent out in August and since recorded as calibrated is
// "ปกติ", not "ส่งสอบเทียบ Aug 2026".
export function statusText(status, note) {
  const trimmed = note?.trim();
  if (trimmed && (NOTE_PREFIXES[status] || []).some((p) => trimmed.startsWith(p))) return trimmed;
  return STATUS_TEXT[status] || status;
}

// 'YYYY-MM-DD' -> a Date at UTC midnight, which ExcelJS writes as that
// calendar day (dateStrings: true means the db never hands us Date objects).
function excelDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const thin = { style: 'thin', color: { argb: 'FF9AA3B2' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

export async function buildRegisterWorkbook(db, now = new Date()) {
  const [equipment] = await db.query('SELECT * FROM equipment ORDER BY equipment_no, equipment_id');
  const [capabilities] = await db.query('SELECT * FROM equipment_capability ORDER BY equipment_id, capability_id');
  const [calibrations] = await db.query(
    `SELECT calibration_id, equipment_id, responsible_person, calibration_frequency, calibration_date,
            next_calibration_date, notes, certificate_filename
     FROM calibration_history ORDER BY equipment_id, calibration_date DESC, calibration_id DESC`
  );

  const capsBy = new Map();
  for (const c of capabilities) {
    if (!capsBy.has(c.equipment_id)) capsBy.set(c.equipment_id, []);
    capsBy.get(c.equipment_id).push(c);
  }
  const calsBy = new Map();
  for (const c of calibrations) {
    if (!calsBy.has(c.equipment_id)) calsBy.set(c.equipment_id, []);
    calsBy.get(c.equipment_id).push(c);
  }

  const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(now);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CalibCare';
  workbook.created = now;

  // --- Sheet 1: the register --------------------------------------------
  const ws = workbook.addWorksheet('FP-ENG-05-01 rev.02', { views: [{ state: 'frozen', ySplit: 4 }] });
  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  ws.getCell('A1').value = `Exported from CalibCare on ${stamp} (Thailand time)`;
  ws.getCell('A1').font = { italic: true, size: 9, color: { argb: 'FF6B7690' } };
  ws.mergeCells('A2:N3');
  ws.getCell('A2').value = 'ทะเบียนควบคุมและประวัติการสอบเทียบเครื่องมือวัด';
  ws.getCell('A2').font = { bold: true, size: 16 };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('O2:P2');
  ws.getCell('O2').value = 'เอกสารเลขที่ : FP-ENG-05-01 Rev.02';
  ws.mergeCells('O3:P3');
  ws.getCell('O3').value = 'เริ่มใช้  : 12 September 2023';

  const header = ws.getRow(4);
  header.values = HEADERS;
  header.height = 36;
  header.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    cell.border = BORDER;
  });

  let r = 5;
  for (const e of equipment) {
    const caps = capsBy.get(e.equipment_id) || [];
    const latest = (calsBy.get(e.equipment_id) || [])[0];
    const rows = caps.length ? caps : [null];
    const first = r;
    for (const [i, c] of rows.entries()) {
      const row = ws.getRow(r);
      row.values = [
        i === 0 ? e.equipment_no : null,
        i === 0 ? e.name : null,
        i === 0 ? e.model : null,
        e.serial_number,
        c?.measurement_purpose ?? null,
        c?.measurement_range ?? null,
        c?.instrument_accuracy ?? null,
        c?.product_operating_range ?? null,
        c?.acceptance_criteria ?? null,
        latest?.responsible_person ?? null,
        latest ? latest.calibration_frequency || '1 ปี' : null,
        excelDate(latest?.calibration_date),
        excelDate(latest?.next_calibration_date),
        i === 0 ? e.location : null,
        i === 0 ? statusText(e.status, e.status_note) : null,
        i === 0 ? e.remarks : null,
      ];
      for (let col = 1; col <= 16; col += 1) {
        const cell = row.getCell(col);
        cell.border = BORDER;
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: col === 1 ? 'center' : undefined };
      }
      row.getCell(12).numFmt = 'dd-mmm-yy';
      row.getCell(13).numFmt = 'dd-mmm-yy';
      r += 1;
    }
    if (r - 1 > first) {
      for (const col of BLOCK_COLUMNS) ws.mergeCells(first, col, r - 1, col);
    }
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 16 } };

  // --- Sheet 2: every calibration, newest first per instrument -----------
  const hist = workbook.addWorksheet('ประวัติการสอบเทียบ', { views: [{ state: 'frozen', ySplit: 1 }] });
  hist.columns = [
    { header: 'เลขที่', width: 7 },
    { header: 'ชื่อเครื่องมือวัด', width: 28 },
    { header: 'หมายเลขเครื่อง', width: 20 },
    { header: 'สอบเทียบเมื่อ', width: 14, style: { numFmt: 'dd-mmm-yy' } },
    { header: 'ครบกำหนด', width: 14, style: { numFmt: 'dd-mmm-yy' } },
    { header: 'ผู้รับผิดชอบ', width: 16 },
    { header: 'ใบรับรอง (PDF)', width: 30 },
    { header: 'หมายเหตุ', width: 30 },
  ];
  hist.getRow(1).font = { bold: true };
  hist.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  for (const e of equipment) {
    for (const c of calsBy.get(e.equipment_id) || []) {
      hist.addRow([
        e.equipment_no, e.name, e.serial_number, excelDate(c.calibration_date), excelDate(c.next_calibration_date),
        c.responsible_person, c.certificate_filename, c.notes,
      ]);
    }
  }
  hist.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

  return {
    workbook,
    filename: `FP-ENG-05-01_CalibCare_${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now)}.xlsx`,
    counts: { equipment: equipment.length, capabilities: capabilities.length, calibrations: calibrations.length },
  };
}
