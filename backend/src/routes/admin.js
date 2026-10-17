import { Router } from 'express';
import { randomInt } from 'node:crypto';
import ExcelJS from 'exceljs';
import { pool } from '../db.js';
import { hashPassword } from '../services/authService.js';
import { createOtp } from '../services/otpStore.js';
import { sendOtpEmail } from '../services/emailService.js';
import { getPosition, canManageAccount } from '../services/positions.js';

// Admin page API -- mounted behind requireAuth + requireCapability('canEdit')
// in server.js, so Deputy Manager and Senior Specialist only. Per-account
// actions are further limited by canManageAccount() (rank-based).
export const adminRouter = Router();

// Readable temporary passwords: no 0/O, 1/l/I look-alikes, so they can be
// read out over the phone or LINE without mistakes.
const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function makeTemporaryPassword(length = 10) {
  let out = '';
  for (let i = 0; i < length; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}

function adminUserRow(row, actorRole, actorId) {
  const position = getPosition(row.role);
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    position_label: position?.label || row.role,
    position_rank: position?.rank ?? null,
    email_verified: Boolean(row.email_verified),
    must_change_password: Boolean(row.must_change_password),
    line_linked: Boolean(row.line_user_id),
    created_at: row.created_at,
    can_manage: row.user_id !== actorId && canManageAccount(actorRole, row.role),
  };
}

async function loadTarget(req, res) {
  const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'user not found' });
    return null;
  }
  const target = rows[0];
  if (target.user_id === req.user.user_id) {
    res.status(403).json({ error: 'use Settings to change your own password' });
    return null;
  }
  if (!canManageAccount(req.user.role, target.role)) {
    res.status(403).json({ error: 'you can only manage accounts junior to your own position' });
    return null;
  }
  return target;
}

// GET /api/admin/users -- every account with its verification / LINE /
// must-change state, plus whether the caller may act on it.
adminRouter.get('/users', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    const users = rows.map((r) => adminUserRow(r, req.user.role, req.user.user_id));
    users.sort((a, b) => a.position_rank - b.position_rank || a.full_name.localeCompare(b.full_name));
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/temporary-password -- for someone locked out.
// Returns the new password ONCE (it is never stored in readable form); the
// user must replace it at next login. Also marks the email verified: the
// admin is vouching for a colleague they know.
adminRouter.post('/users/:id/temporary-password', async (req, res, next) => {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;

    const temporaryPassword = makeTemporaryPassword();
    const password_hash = await hashPassword(temporaryPassword);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 1, email_verified = 1 WHERE user_id = ?', [
      password_hash,
      target.user_id,
    ]);
    console.log(`[admin] user ${req.user.user_id} issued a temporary password for user ${target.user_id}`);

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [target.user_id]);
    res.json({ temporaryPassword, user: adminUserRow(rows[0], req.user.role, req.user.user_id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/resend-verification -- for someone who
// registered but never entered their email code.
adminRouter.post('/users/:id/resend-verification', async (req, res, next) => {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.email_verified) {
      return res.status(400).json({ error: 'this email is already verified' });
    }
    const { code } = createOtp(target.email, 'register');
    const result = await sendOtpEmail(target.email, code, 'register');
    res.json({ message: `verification code sent to ${target.email}`, emailDryRun: Boolean(result?.dryRun) });
  } catch (err) {
    next(err);
  }
});

// Every table, as one sheet each. Users never include password hashes or
// raw LINE ids; calibration certificates are listed by file name only (the
// PDFs themselves stay in the database).
const BACKUP_SHEETS = [
  { name: 'Equipment', sql: 'SELECT * FROM equipment ORDER BY equipment_no' },
  { name: 'Capabilities', sql: 'SELECT * FROM equipment_capability ORDER BY equipment_id, capability_id' },
  {
    name: 'Calibration history',
    sql: `SELECT calibration_id, equipment_id, calibration_date, next_calibration_date, calibration_frequency,
                 responsible_person, notes, certificate_filename, certificate_size, created_at
          FROM calibration_history ORDER BY equipment_id, calibration_date`,
  },
  {
    name: 'Users',
    sql: `SELECT user_id, full_name, email, role AS position, email_verified, must_change_password,
                 IF(line_user_id IS NULL, 'no', 'yes') AS line_linked, created_at
          FROM users ORDER BY user_id`,
  },
  { name: 'Reminder rules', sql: 'SELECT * FROM reminder_rule' },
  { name: 'Reminders sent', sql: 'SELECT * FROM notification_log ORDER BY 1' },
  { name: 'Calendar notes', sql: 'SELECT * FROM calendar_note ORDER BY 1' },
];

// GET /api/admin/backup.xlsx -- the whole database as one Excel workbook.
adminRouter.get('/backup.xlsx', async (req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CalibCare';
    workbook.created = new Date();

    const about = workbook.addWorksheet('About');
    const counts = [];

    for (const sheet of BACKUP_SHEETS) {
      const [rows, fields] = await pool.query(sheet.sql);
      const ws = workbook.addWorksheet(sheet.name);
      const columns = fields.map((f) => f.name);
      ws.columns = columns.map((c) => ({
        header: c,
        key: c,
        width: Math.min(60, Math.max(c.length + 2, ...rows.slice(0, 200).map((r) => String(r[c] ?? '').length + 2))),
      }));
      ws.addRows(rows);
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      counts.push([sheet.name, rows.length]);
    }

    about.columns = [
      { header: 'CalibCare database backup', key: 'a', width: 34 },
      { header: '', key: 'b', width: 60 },
    ];
    about.getRow(1).font = { bold: true, size: 14 };
    about.addRow(['Created', new Date().toISOString()]);
    about.addRow(['Created by', req.user.email]);
    about.addRow([]);
    about.addRow(['Sheet', 'Rows']).font = { bold: true };
    counts.forEach((c) => about.addRow(c));
    about.addRow([]);
    about.addRow(['Not included', 'Passwords (stored scrambled, never exported), LINE ids, certificate PDF files']);

    console.log(`[admin] user ${req.user.user_id} downloaded a database backup`);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="calibcare-backup-${stamp}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});
