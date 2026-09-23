/**
 * Short-lived one-time codes for email verification and password reset.
 * Same shape as linkCodeStore.js's LINE-linking codes (in-memory, not a DB
 * table -- these are single-use and expire in minutes; losing pending codes
 * on a server restart just means requesting a new one).
 *
 * Keyed by `${email}:${purpose}` so a "register" code and a "reset" code
 * for the same address never collide, and requesting a new one for the
 * same purpose simply overwrites the pending one (only the latest is ever
 * valid).
 */
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const otps = new Map(); // key -> { code, expiresAt }

function key(email, purpose) {
  return `${String(email).trim().toLowerCase()}:${purpose}`;
}

function generateCode() {
  // 6 digits, easy to type on a phone keyboard.
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createOtp(email, purpose) {
  const code = generateCode();
  const expiresAt = Date.now() + TTL_MS;
  otps.set(key(email, purpose), { code, expiresAt });
  return { code, expiresAt };
}

/** Verifies and consumes a code if valid and unexpired. Single-use. */
export function verifyOtp(email, purpose, code) {
  const k = key(email, purpose);
  const entry = otps.get(k);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otps.delete(k);
    return false;
  }
  if (String(code).trim() !== entry.code) return false;
  otps.delete(k);
  return true;
}

/** Test/ops helper. */
export function _clearAllOtps() {
  otps.clear();
}
