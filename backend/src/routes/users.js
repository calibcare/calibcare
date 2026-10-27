import { Router } from 'express';
import { pool } from '../db.js';
import { requireCapability } from '../middleware/auth.js';
import { POSITIONS, getPosition, canAssignPosition } from '../services/positions.js';
import { toPublicUser } from './auth.js';

export const usersRouter = Router();

// GET /api/users/positions -- the ranked access-level catalogue. Declared
// before the /:id routes so it can't be swallowed by them.
usersRouter.get('/positions', (req, res) => {
  res.json(POSITIONS);
});

// GET /api/users/me -- the current user, including position and capability
// flags. Lets the frontend refresh a cached user whose position changed.
usersRouter.get('/me', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.user.user_id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'user not found' });
    }
    res.json(toPublicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

// GET /api/users -- everyone with access to the system, most senior first.
// Readable by any logged-in position: this is the "who can access this
// website" list, not privileged data (no password hashes, see toPublicUser).
usersRouter.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    const users = rows.map(toPublicUser);
    users.sort((a, b) => a.position_rank - b.position_rank || a.full_name.localeCompare(b.full_name));
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/position -- promote or demote someone (System Owner
// and Deputy Manager, the positions that carry canRunReminders; only the
// Owner can touch the Owner position -- see canAssignPosition()).
usersRouter.patch('/:id/position', requireCapability('canRunReminders'), async (req, res, next) => {
  try {
    const { position } = req.body;
    if (!getPosition(position)) {
      return res.status(400).json({ error: `position must be one of ${POSITIONS.map((p) => p.key).join(', ')}` });
    }
    // Guard against the last Deputy Manager demoting themselves, which
    // would leave nobody able to assign positions at all.
    if (Number(req.params.id) === req.user.user_id) {
      return res.status(403).json({ error: 'you cannot change your own position' });
    }

    const [targets] = await pool.query('SELECT role FROM users WHERE user_id = ?', [req.params.id]);
    if (targets.length === 0) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (!canAssignPosition(req.user.role, targets[0].role, position)) {
      return res.status(403).json({ error: 'only the System Owner can give or change the System Owner position' });
    }

    await pool.query('UPDATE users SET role = ? WHERE user_id = ?', [position, req.params.id]);

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    res.json(toPublicUser(rows[0]));
  } catch (err) {
    next(err);
  }
});
