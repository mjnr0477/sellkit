'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAccessToken, verifyAccessToken } = require('./access-token');

const secret = 'test-secret-that-is-at-least-thirty-two-characters';

test('signed access token is valid only inside the entitlement time window', () => {
  const token = createAccessToken({
    id: 'entitlement-1', paymentId: 'payment-1', userId: 'user-1',
    packageId: 'time-12h-kes10', startsAt: 1000, expiresAt: 5000,
  }, secret);
  assert.equal(verifyAccessToken(token, secret, 999).reason, 'not_yet_active');
  const active = verifyAccessToken(token, secret, 1001);
  assert.equal(active.allowed, true);
  assert.equal(active.subject, 'user-1');
  assert.equal(verifyAccessToken(token, secret, 5000).reason, 'expired');
});

test('modified or wrongly signed token is denied', () => {
  const token = createAccessToken({
    id: 'entitlement-2', userId: 'user-2', startsAt: 1000, expiresAt: 5000,
  }, secret);
  assert.equal(verifyAccessToken(token + 'x', secret, 2000).reason, 'invalid_signature');
  assert.equal(verifyAccessToken(token, 'wrong-secret-that-is-long-enough-to-be-valid', 2000).reason, 'invalid_signature');
});

test('rejects weak secrets and malformed entitlement input', () => {
  assert.throws(() => createAccessToken({}, 'short'), /at least 32 characters/);
  assert.throws(() => createAccessToken({ id: 'x' }, secret), /valid persisted entitlement/);
});
