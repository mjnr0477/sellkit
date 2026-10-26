'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEntitlement } = require('./entitlement');
const { decideSessionAdmission } = require('./session-policy');

const now = 1_800_000_000_000;
const entitlement = createEntitlement({
  id: 'lease-1',
  userId: 'user-1',
  startsAt: now,
  durationMs: 60_000,
});
const healthyUplink = { authorized: true, ready: true, capacityAvailable: true };

test('admits an active lease only on a ready authorized uplink', () => {
  const result = decideSessionAdmission({ entitlement, trustedNow: now + 1, uplink: healthyUplink });
  assert.equal(result.admitted, true);
  assert.equal(result.reason, 'active');
  assert.equal(result.remainingMs, 59_999);
  assert.equal(result.policy, 'time-only');
});

test('denies before the entitlement start time', () => {
  const result = decideSessionAdmission({ entitlement, trustedNow: now - 1, uplink: healthyUplink });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'not_started');
});

test('denies at exact expiry and after expiry', () => {
  for (const trustedNow of [now + 60_000, now + 60_001]) {
    const result = decideSessionAdmission({ entitlement, trustedNow, uplink: healthyUplink });
    assert.equal(result.admitted, false);
    assert.equal(result.reason, 'expired');
  }
});

test('denies an active lease if upstream authorization is absent', () => {
  const result = decideSessionAdmission({
    entitlement,
    trustedNow: now + 1,
    uplink: { ...healthyUplink, authorized: false },
  });
  assert.equal(result.admitted, false);
  assert.equal(result.reason, 'upstream_not_authorized');
});

test('denies when upstream is unavailable or capacity is exhausted', () => {
  assert.equal(decideSessionAdmission({
    entitlement, trustedNow: now + 1, uplink: { ...healthyUplink, ready: false },
  }).reason, 'upstream_unavailable');
  assert.equal(decideSessionAdmission({
    entitlement, trustedNow: now + 1, uplink: { ...healthyUplink, capacityAvailable: false },
  }).reason, 'capacity_unavailable');
});

test('rejects missing or invalid trusted inputs', () => {
  assert.throws(() => decideSessionAdmission({ entitlement, trustedNow: NaN, uplink: healthyUplink }), /required/);
  assert.throws(() => decideSessionAdmission({ entitlement, trustedNow: now }), /required/);
});
