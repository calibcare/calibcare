import { verifyToken } from '../services/authService.js';
import { hasCapability } from '../services/positions.js';
import { pool } from '../db.js';

/**
 * Verifies the JWT, then loads the user's CURRENT position from the
 * database rather than trusting the role claim inside the token. Tokens
 * here last 30 days, so a position change by a Deputy Manager would
 * otherwise not take effect until the affected person happened to log in
 * again -- and tokens issued before the position migration still carry
 * long-gone role strings.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing or malformed Authorization header' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }

  try {
    const [rows] = await pool.query('SELECT user_id, email, role FROM users WHERE user_id = ?', [payload.sub]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'account no longer exists' });
    }
    req.user = { user_id: rows[0].user_id, role: rows[0].role, email: rows[0].email };
    next();
  } catch (err) {
    next(err);
  }
}

/** Gates a route on a capability from positions.js, e.g. 'canEdit'. */
export function requireCapability(capability) {
  return (req, res, next) => {
    if (!req.user || !hasCapability(req.user.role, capability)) {
      return res.status(403).json({ error: 'insufficient permissions' });
    }
    next();
  };
}
