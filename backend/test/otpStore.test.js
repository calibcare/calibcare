import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOtp, verifyOtp, _clearAllOtps } from '../src/services/otpStore.js';

test.beforeEach(() => _clearAllOtps());

test('a generated code can be verified once for the right email+purpose', () => {
  const { code } = createOtp('a@idsmed.com', 'register');
  assert.equal(verifyOtp('a@idsmed.com', 'register', code), true);
});

test('a code is single-use -- verifying it twice fails the second time', () => {
  const { code } = createOtp('a@idsmed.com', 'register');
  assert.equal(verifyOtp('a@idsmed.com', 'register', code), true);
  assert.equal(verifyOtp('a@idsmed.com', 'register', code), false);
});

test('an unknown email/purpose combination fails', () => {
  assert.equal(verifyOtp('nobody@idsmed.com', 'register', '123456'), false);
});

test('the wrong code for a real pending request fails, and does not consume it', () => {
  const { code } = createOtp('a@idsmed.com', 'register');
  assert.equal(verifyOtp('a@idsmed.com', 'register', '000000'), false);
  // the real code must still work afterward -- a wrong guess shouldn't burn the real one
  assert.equal(verifyOtp('a@idsmed.com', 'register', code), true);
});

test('register and reset codes for the same email are independent', () => {
  const { code: registerCode } = createOtp('a@idsmed.com', 'register');
  const { code: resetCode } = createOtp('a@idsmed.com', 'reset');
  assert.equal(verifyOtp('a@idsmed.com', 'reset', registerCode), false);
  assert.equal(verifyOtp('a@idsmed.com', 'register', registerCode), true);
  assert.equal(verifyOtp('a@idsmed.com', 'reset', resetCode), true);
});

test('requesting a new code for the same email+purpose invalidates the old one', () => {
  const { code: first } = createOtp('a@idsmed.com', 'register');
  const { code: second } = createOtp('a@idsmed.com', 'register');
  assert.equal(verifyOtp('a@idsmed.com', 'register', first), false);
  assert.equal(verifyOtp('a@idsmed.com', 'register', second), true);
});

test('email matching is case-insensitive', () => {
  const { code } = createOtp('Someone@IDSMED.com', 'register');
  assert.equal(verifyOtp('someone@idsmed.com', 'register', code), true);
});

test('codes are 6 digits', () => {
  const { code } = createOtp('a@idsmed.com', 'register');
  assert.match(code, /^\d{6}$/);
});
