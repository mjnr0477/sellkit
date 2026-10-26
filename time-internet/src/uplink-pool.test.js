import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPool,
  admitLease,
  authorizeTraffic,
  reconcilePool,
} from './uplink-pool.js';

test('admits a lease only onto an active, explicitly authorized uplink', () => {
  const pool = createPool([
    { id: 'unapproved', capacityMbps: 100, authorized: false },
    { id: 'approved', capacityMbps: 5, authorized: true },
  ]);
  const route = admitLease(pool, { id: 'lease-1', expiresAt: 20_000 }, 10_000);
  assert.equal(route.uplinkId, 'approved');
  assert.equal(route.policy, 'time-only');
  assert.equal(authorizeTraffic(pool, route, 10_001), true);
});

test('rejects admission if no authorized uplink capacity exists', () => {
  const pool = createPool([{ id: 'no', capacityMbps: 10, authorized: false }]);
  assert.throws(() => admitLease(pool, { id: 'lease-1', expiresAt: 20_000 }, 10_000),
    /No authorized uplink capacity/);
});

test('rejects already-expired leases and duplicate active lease ids', () => {
  const pool = createPool([{ id: 'uplink', capacityMbps: 10, authorized: true }]);
  assert.throws(() => admitLease(pool, { id: 'old', expiresAt: 10_000 }, 10_000),
    /future expiresAt/);
  admitLease(pool, { id: 'same', expiresAt: 30_000 }, 10_000);
  assert.throws(() => admitLease(pool, { id: 'same', expiresAt: 40_000 }, 10_000),
    /already admitted/);
});

test('traffic authorization fails exactly at expiry and reconciliation frees capacity', () => {
  const pool = createPool([{ id: 'uplink', capacityMbps: 10, authorized: true, maxSessions: 1 }]);
  const route = admitLease(pool, { id: 'lease-1', expiresAt: 12_000 }, 10_000);
  assert.equal(authorizeTraffic(pool, route, 11_999), true);
  assert.equal(authorizeTraffic(pool, route, 12_000), false);
  assert.equal(reconcilePool(pool, 12_000), 1);
  assert.equal(pool.get('uplink').sessions.size, 0);
  const next = admitLease(pool, { id: 'lease-2', expiresAt: 22_000 }, 12_000);
  assert.equal(next.uplinkId, 'uplink');
});

test('disabled or de-authorized uplinks immediately fail traffic checks', () => {
  const pool = createPool([{ id: 'uplink', capacityMbps: 10, authorized: true }]);
  const route = admitLease(pool, { id: 'lease-1', expiresAt: 30_000 }, 10_000);
  pool.get('uplink').active = false;
  assert.equal(authorizeTraffic(pool, route, 11_000), false);
  assert.equal(reconcilePool(pool, 11_000), 1);
});

test('lease expiry is isolated between independent pools with the same lease id', () => {
  const first = createPool([{ id: 'uplink-a', capacityMbps: 10, authorized: true }]);
  const second = createPool([{ id: 'uplink-b', capacityMbps: 10, authorized: true }]);
  const routeA = admitLease(first, { id: 'shared-id', expiresAt: 12_000 }, 10_000);
  const routeB = admitLease(second, { id: 'shared-id', expiresAt: 30_000 }, 10_000);

  assert.equal(reconcilePool(first, 12_000), 1);
  assert.equal(authorizeTraffic(first, routeA, 12_000), false);
  assert.equal(authorizeTraffic(second, routeB, 12_001), true);
  assert.equal(second.get('uplink-b').sessions.get('shared-id'), 30_000);
});

test('rejects route expiry tampering instead of trusting caller-supplied expiry', () => {
  const pool = createPool([{ id: 'uplink', capacityMbps: 10, authorized: true }]);
  const route = admitLease(pool, { id: 'lease-1', expiresAt: 12_000 }, 10_000);
  assert.equal(authorizeTraffic(pool, { ...route, expiresAt: 99_000 }, 11_000), false);
});
