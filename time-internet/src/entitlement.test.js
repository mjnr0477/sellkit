'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEntitlement, evaluateEntitlement } = require('./entitlement');

const HOUR = 60 * 60 * 1000;

test('ticket is active inside its time window regardless of data volume concept', () => {
  const ticket = createEntitlement({
    id: 'ticket-1', userId: 'user-1', startsAt: 1_000, durationMs: 12 * HOUR,
  });
  assert.equal(ticket.expiresAt, 1_000 + 12 * HOUR);
  assert.equal(evaluateEntitlement(ticket, 1_000).state, 'active');
  assert.equal(evaluateEntitlement(ticket, 1_000 + 6 * HOUR).active, true);
  assert.equal(evaluateEntitlement(ticket, ticket.expiresAt - 1).active, true);
});

test('ticket is not active before its start time', () => {
  const ticket = createEntitlement({
    id: 'ticket-2', userId: 'user-1', startsAt: 10_000, durationMs: 60_000,
  });
  assert.equal(evaluateEntitlement(ticket, 9_999).state, 'not_started');
});

test('ticket expires exactly at the expiry timestamp', () => {
  const ticket = createEntitlement({
    id: 'ticket-3', userId: 'user-1', startsAt: 10_000, durationMs: 60_000,
  });
  assert.equal(evaluateEntitlement(ticket, ticket.expiresAt - 1).active, true);
  assert.equal(evaluateEntitlement(ticket, ticket.expiresAt).state, 'expired');
});

test('rejects invalid durations and missing identities', () => {
  assert.throws(() => createEntitlement({
    id: '', userId: 'user-1', startsAt: 0, durationMs: HOUR,
  }), /id is required/);
  assert.throws(() => createEntitlement({
    id: 'ticket-4', userId: 'user-1', startsAt: 0, durationMs: 0,
  }), /durationMs/);
  assert.throws(() => createEntitlement({
    id: 'ticket-5', userId: 'user-1', startsAt: 0, durationMs: 32 * 24 * HOUR,
  }), /durationMs/);
});

test('rejects invalid trusted clock input', () => {
  const ticket = createEntitlement({
    id: 'ticket-6', userId: 'user-1', startsAt: 0, durationMs: HOUR,
  });
  assert.throws(() => evaluateEntitlement(ticket, NaN), /trustedNow/);
});
