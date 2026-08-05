/**
 * Short-lived codes used to link a logged-in CalibCare user to their LINE
 * account: the user requests a code in the app, sends it as a LINE message
 * to the Official Account, and the webhook matches the code back to their
 * user_id. Deliberately in-memory (not a DB table) -- these are single-use,
 * expire in minutes, and losing pending codes on a server restart just
 * means the user requests a new one; not worth a schema migration for.
 */
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const codes = new Map(); // code -> { userId, expiresAt }

function generateCode() {
  // 6 digits, easy to type on a phone keyboard while chatting.
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createLinkCode(userId) {
  let code = generateCode();
  while (codes.has(code)) code = generateCode(); // avoid an active collision
  const expiresAt = Date.now() + TTL_MS;
  codes.set(code, { userId, expiresAt });
  return { code, expiresAt };
}

/** Consumes a code if valid and unexpired; returns the userId or null. Single-use. */
export function consumeLinkCode(code) {
  const key = String(code).trim();
  const entry = codes.get(key);
  if (!entry) return null;
  codes.delete(key);
  if (Date.now() > entry.expiresAt) return null;
  return entry.userId;
}

/** Test/ops helper. */
export function _clearAllCodes() {
  codes.clear();
}
