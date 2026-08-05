import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRange } from '../src/services/rangeParser.js';

test('plain hyphen range', () => {
  assert.deepEqual(parseRange('0-30 psi'), { min: 0, max: 30, unit: 'psi', raw: '0-30 psi' });
});

test('hyphen range with leading space', () => {
  const r = parseRange(' 0-15 psi');
  assert.equal(r.min, 0);
  assert.equal(r.max, 15);
  assert.equal(r.unit, 'psi');
});

test('hyphen range with unit glued to number', () => {
  const r = parseRange('35-160kVp');
  assert.equal(r.min, 35);
  assert.equal(r.max, 160);
  assert.equal(r.unit, 'kvp');
});

test('negative-to-positive "to" range', () => {
  const r = parseRange('-0.8 to 10 bar');
  assert.equal(r.min, -0.8);
  assert.equal(r.max, 10);
  assert.equal(r.unit, 'bar');
});

test('symmetric plus-minus range', () => {
  const r = parseRange('0 to ±200 slpm');
  assert.equal(r.min, -200);
  assert.equal(r.max, 200);
  assert.equal(r.unit, 'slpm');
});

test('decimal hyphen range (product operating range style)', () => {
  const r = parseRange('0-0.14 bar');
  assert.equal(r.min, 0);
  assert.equal(r.max, 0.14);
});

test('to-separated l/min range', () => {
  const r = parseRange('-300 to 300 l/min');
  assert.equal(r.min, -300);
  assert.equal(r.max, 300);
  assert.equal(r.unit, 'l/min');
});

test('null/empty input', () => {
  assert.equal(parseRange(null), null);
  assert.equal(parseRange(''), null);
  assert.equal(parseRange('  '), null);
});
