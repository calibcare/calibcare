import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkCode, consumeLinkCode, _clearAllCodes } from '../src/services/linkCodeStore.js';

test.beforeEach(() => _clearAllCodes());

test('a generated code can be consumed once for the right user', () => {
  const { code } = createLinkCode(42);
  assert.equal(consumeLinkCode(code), 42);
});

test('a code is single-use -- consuming it twice returns null the second time', () => {
  const { code } = createLinkCode(7);
  assert.equal(consumeLinkCode(code), 7);
  assert.equal(consumeLinkCode(code), null);
});

test('an unknown code returns null', () => {
  assert.equal(consumeLinkCode('000000'), null);
});

test('consumeLinkCode trims whitespace (users often paste with stray spaces)', () => {
  const { code } = createLinkCode(5);
  assert.equal(consumeLinkCode(`  ${code}  `), 5);
});

test('a whitespace-padded code is still single-use after consumption', () => {
  const { code } = createLinkCode(9);
  assert.equal(consumeLinkCode(`  ${code}  `), 9);
  assert.equal(consumeLinkCode(code), null); // must be gone, not just the padded variant
});

test('codes are 6 digits', () => {
  const { code } = createLinkCode(1);
  assert.match(code, /^\d{6}$/);
});
