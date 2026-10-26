'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PACKAGES, getPackage } = require('./packages');

test('KSh 10 package represents a 12-hour time entitlement', () => {
  const plan = getPackage('time-12h-kes10');
  assert.equal(plan.amountKes, 10);
  assert.equal(plan.durationMs, 12 * 60 * 60 * 1000);
});

test('unknown packages cannot be purchased', () => {
  assert.equal(getPackage('made-up-plan'), null);
});

test('catalogue plans have valid unique identifiers and positive values', () => {
  assert.equal(new Set(PACKAGES.map((p) => p.id)).size, PACKAGES.length);
  for (const plan of PACKAGES) {
    assert.ok(Number.isSafeInteger(plan.amountKes) && plan.amountKes > 0);
    assert.ok(Number.isSafeInteger(plan.durationMs) && plan.durationMs > 0);
  }
});
