import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, verifyPassword, signToken } from '../services/authService.js';

export const authRouter = Router();

const VALID_ROLES = ['admin', 'engineer', 'qa', 'manager'];

function toPublicUser(row) {
  return {
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    line_user_id: row.line_user_id,
  };
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const { full_name, email, password, role, line_user_id } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, and password are required' });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${VALID_ROLES.join(', ')}` });
    }

    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'a user with this email already exists' });
    }

    const password_hash = await hashPassword(password);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, line_user_id) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, password_hash, role || 'engineer', line_user_id || null]
    );

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
    const user = toPublicUser(rows[0]);
    res.status(201).json({ token: signToken(rows[0]), user });
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

    res.json({ token: signToken(rows[0]), user: toPublicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});
