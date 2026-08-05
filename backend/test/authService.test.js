import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/services/authService.js';

// authService.js itself loads backend/.env (for JWT_SECRET) via `import 'dotenv/config'`,
// so no test-specific env setup is needed here -- it reuses the real local .env.

test('hashPassword + verifyPassword round-trip', async () => {
  const hash = await hashPassword('correct-horse-battery-staple');
  assert.notEqual(hash, 'correct-horse-battery-staple');
  assert.equal(await verifyPassword('correct-horse-battery-staple', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('signToken + verifyToken round-trip carries user_id/role/email', () => {
  const token = signToken({ user_id: 42, role: 'engineer', email: 'e@example.com' });
  const payload = verifyToken(token);
  assert.equal(payload.sub, 42);
  assert.equal(payload.role, 'engineer');
  assert.equal(payload.email, 'e@example.com');
});

test('verifyToken rejects a tampered token', () => {
  const token = signToken({ user_id: 1, role: 'admin', email: 'a@example.com' });
  assert.throws(() => verifyToken(token + 'tampered'));
});
