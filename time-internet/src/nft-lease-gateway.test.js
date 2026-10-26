import test from 'node:test';
import assert from 'node:assert/strict';
import { createNftLeaseGateway } from './nft-lease-gateway.js';

test('grants a client only for the remaining server-authoritative lease time', async () => {
  const calls = [];
  const gateway = createNftLeaseGateway({ run: async (...args) => calls.push(args) });
  const result = await gateway.grant('10.8.0.2', 12_500, 10_000);
  assert.deepEqual(calls, [[
    'nft', ['add', 'element', 'inet', 'timed_access', 'active_clients',
      '{', '10.8.0.2', 'timeout', '3s', '}'],
  ]]);
  assert.equal(result.ttlSeconds, 3);
  assert.equal(result.enforcement, 'nftables-timeout');
});

test('rejects expired or invalid leases without running nft', async () => {
  let called = false;
  const gateway = createNftLeaseGateway({ run: async () => { called = true; } });
  await assert.rejects(gateway.grant('10.8.0.2', 10_000, 10_000), /future server-authoritative/);
  await assert.rejects(gateway.grant('10.8.0.999', 20_000, 10_000), /valid IPv4/);
  assert.equal(called, false);
});

test('uses an argument array for revocation and validates the address', async () => {
  const calls = [];
  const gateway = createNftLeaseGateway({ run: async (...args) => calls.push(args) });
  await gateway.revoke('10.8.0.3');
  assert.deepEqual(calls, [['nft', [
    'delete', 'element', 'inet', 'timed_access', 'active_clients', '{', '10.8.0.3', '}',
  ]]]);
  await assert.rejects(gateway.revoke('10.8.0.3; reboot'), /valid IPv4/);
});
