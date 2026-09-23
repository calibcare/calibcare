import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, verifyPassword, signToken } from '../services/authService.js';
import { createOtp, verifyOtp } from '../services/otpStore.js';
import { sendOtpEmail } from '../services/emailService.js';
import { getPosition, DEFAULT_POSITION_KEY } from '../services/positions.js';

export const authRouter = Router();

// Position label/rank and capability flags travel with every user the API
// returns, so the frontend never keeps its own copy of the hierarchy.
export function toPublicUser(row) {
  const position = getPosition(row.role);
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    position_label: position?.label || row.role,
    position_rank: position?.rank ?? null,
    can_edit: Boolean(position?.canEdit),
    can_run_reminders: Boolean(position?.canRunReminders),
    line_user_id: row.line_user_id,
  };
}

// Only new registrations are domain-restricted -- accounts that already
// existed before this feature are grandfathered in (see
// database/add_email_verification.sql) and can keep logging in regardless
// of their email's domain.
function isAllowedDomain(email) {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (!domain) return true; // unset = no restriction
  return String(email).trim().toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const { full_name, email, password, line_user_id } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, and password are required' });
    }
    if (!isAllowedDomain(email)) {
      return res.status(403).json({ error: `registration is restricted to @${process.env.ALLOWED_EMAIL_DOMAIN} email addresses` });
    }

    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'a user with this email already exists' });
    }

    // Position is deliberately NOT taken from the request body -- everyone
    // starts at the most junior level and is promoted by a Deputy Manager,
    // otherwise anyone signing up could hand themselves full access.
    const password_hash = await hashPassword(password);
    await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, line_user_id, email_verified) VALUES (?, ?, ?, ?, ?, 0)',
      [full_name, email, password_hash, DEFAULT_POSITION_KEY, line_user_id || null]
    );

    const { code } = createOtp(email, 'register');
    const sendResult = await sendOtpEmail(email, code, 'register');

    res.status(201).json({
      message: 'account created -- check your email for a verification code',
      email,
      emailDryRun: sendResult.dryRun,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'email and code are required' });
    }

    const ok = verifyOtp(email, 'register', code);
    if (!ok) {
      return res.status(400).json({ error: 'invalid or expired code' });
    }

    await pool.query('UPDATE users SET email_verified = 1 WHERE email = ?', [email]);
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'user not found' });
    }

    res.json({ token: signToken(rows[0]), user: toPublicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/resend-otp', async (req, res, next) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !['register', 'reset'].includes(purpose)) {
      return res.status(400).json({ error: 'email and a valid purpose (register or reset) are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    // Generic response either way -- avoids confirming whether an email is
    // registered, same reasoning as login's identical error message for
    // "wrong password" vs "unknown email".
    if (rows.length > 0) {
      const { code } = createOtp(email, purpose);
      await sendOtpEmail(email, code, purpose);
    }

    res.json({ message: 'if that email is registered, a new code has been sent' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      const { code } = createOtp(email, 'reset');
      await sendOtpEmail(email, code, 'reset');
    }

    // Same email either way -- never reveal whether the address exists.
    res.json({ message: 'if that email is registered, a password reset code has been sent' });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code, and newPassword are required' });
    }

    const ok = verifyOtp(email, 'reset', code);
    if (!ok) {
      return res.status(400).json({ error: 'invalid or expired code' });
    }

    const password_hash = await hashPassword(newPassword);
    await pool.query('UPDATE users SET password_hash = ? WHERE email = ?', [password_hash, email]);

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'user not found' });
    }

    res.json({ token: signToken(rows[0]), user: toPublicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'invalid email or password' });
    }

    const ok = await verifyPassword(password, rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid email or password' });
    }

    if (!rows[0].email_verified) {
      return res.status(403).json({ error: 'email not verified', code: 'EMAIL_NOT_VERIFIED', email: rows[0].email });
    }

    res.json({ token: signToken(rows[0]), user: toPublicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});
