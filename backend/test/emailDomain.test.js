import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedDomain } from '../src/services/emailDomain.js';

test('isAllowedDomain accepts only the company domain, ignoring case and spaces', () => {
  assert.equal(isAllowedDomain('engineer@idsmed.com', 'idsmed.com'), true);
  assert.equal(isAllowedDomain(' Engineer@IDSMED.com ', 'idsmed.com'), true);
  assert.equal(isAllowedDomain('someone@gmail.com', 'idsmed.com'), false);
  assert.equal(isAllowedDomain('fake@notidsmed.com', 'idsmed.com'), false);
});

test('isAllowedDomain allows any address when no domain is configured', () => {
  assert.equal(isAllowedDomain('someone@gmail.com', ''), true);
  assert.equal(isAllowedDomain('someone@gmail.com', null), true);
});
