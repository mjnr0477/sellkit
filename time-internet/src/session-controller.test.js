import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntitlement } from './entitlement.js';
import { createSessionController } from './session-controller.js';

const now = 1_800_000_000_000;
const entitlement = createEntitlement({
  id: 'entitlement-1',
  userId: 'user-1',
  startsAt: now,
  durationMs: 120_000,
});
const uplink = { authorized: true, ready: true, capacityAvailable: true };

function fakeGateway({ failGrant = false, failRevoke = false } = {}) {
  const calls = [];
  return {
    calls,
    async grant(ip, expiresAt, at) {
      calls.push({ method: 'grant', ip, expiresAt, at });
      if (failGrant) throw new Error('gateway grant failed');
      return { enforcement: 'test-gateway' };
    },
    async revoke(ip) {
      calls.push({ method: 'revoke', ip });
      if (failRevoke) throw new Error('gateway revoke failed');
    },
  };
}

test('activates only after gateway confirms the timed lease', async () => {
  const gateway = fakeGateway();
  const controller = createSessionController({ gateway, clock: () => now + 1 });
  const result = await controller.activate({ entitlement, uplink, clientIp: '10.0.0.2' });
  assert.equal(result.admitted, true);
  assert.equal(result.expiresAt, entitlement.expiresAt);
  assert.equal(result.enforcement, 'test-gateway');
  assert.equal(controller.inspect(entitlement.id).expired, false);
  assert.equal(gateway.calls.length, 1);
});

test('does not mark a session active if the gateway grant fails', async () => {
  const controller = createSessionController({ gateway: fakeGateway({ failGrant: true }), clock: () => now + 1 });
  await assert.rejects(controller.activate({ entitlement, uplink, clientIp: '10.0.0.2' }), /gateway grant failed/);
  assert.equal(controller.inspect(entitlement.id), null);
});

test('fails closed for unauthorized uplinks and expired entitlements', async () => {
  const gateway = fakeGateway();
  const controller = createSessionController({ gateway, clock: () => now + 1 });
  const denied = await controller.activate({
    entitlement, uplink: { ...uplink, authorized: false }, clientIp: '10.0.0.2',
  });
  assert.equal(denied.admitted, false);
  assert.equal(denied.reason, 'upstream_not_authorized');
  assert.equal(gateway.calls.length, 0);

  const expiredController = createSessionController({ gateway, clock: () => entitlement.expiresAt });
  const expired = await expiredController.activate({ entitlement, uplink, clientIp: '10.0.0.3' });
  assert.equal(expired.admitted, false);
  assert.equal(expired.reason, 'expired');
});

test('revoke retries remain possible if the gateway fails', async () => {
  let fail = true;
  const calls = [];
  const gateway = {
    async grant(ip, expiresAt) { return { ip, expiresAt }; },
    async revoke(ip) { calls.push(ip); if (fail) throw new Error('revoke failed'); },
  };
  const controller = createSessionController({ gateway, clock: () => now + 1 });
  await controller.activate({ entitlement, uplink, clientIp: '10.0.0.4' });
  await assert.rejects(controller.deactivate(entitlement.id), /revoke failed/);
  assert.notEqual(controller.inspect(entitlement.id), null);
  fail = false;
  const result = await controller.deactivate(entitlement.id);
  assert.equal(result.revoked, true);
  assert.equal(controller.inspect(entitlement.id), null);
  assert.deepEqual(calls, ['10.0.0.4', '10.0.0.4']);
});

test('prevents duplicate active sessions and validates inputs', async () => {
  const controller = createSessionController({ gateway: fakeGateway(), clock: () => now + 1 });
  await controller.activate({ entitlement, uplink, clientIp: '10.0.0.5' });
  const duplicate = await controller.activate({ entitlement, uplink, clientIp: '10.0.0.5' });
  assert.equal(duplicate.admitted, false);
  assert.equal(duplicate.reason, 'session_already_active');
  await assert.rejects(controller.activate({ entitlement, uplink }), /client IP/);
});
