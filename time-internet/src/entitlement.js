/**
 * Minimal time-entitlement core for the fresh Time-Based Internet experiment.
 *
 * This module models the access ticket only. It does NOT provide internet
 * connectivity, route packets, bypass a carrier, or prove unlimited supply.
 * Production access decisions must use a trusted server clock and must be
 * enforced by the authorized traffic gateway.
 */

'use strict';

const MAX_DURATION_MS = 31 * 24 * 60 * 60 * 1000;

function createEntitlement({ id, userId, startsAt, durationMs }) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('id is required');
  if (typeof userId !== 'string' || !userId.trim()) throw new TypeError('userId is required');
  if (!Number.isSafeInteger(startsAt) || startsAt < 0) {
    throw new TypeError('startsAt must be a non-negative epoch timestamp in milliseconds');
  }
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
    throw new RangeError('durationMs must be between 1 ms and 31 days');
  }

  return Object.freeze({
    id,
    userId,
    startsAt,
    expiresAt: startsAt + durationMs,
    policy: 'time-only',
  });
}

/**
 * Evaluate the ticket using a caller-supplied trusted timestamp.
 * Byte counts are intentionally absent from this API.
 */
function evaluateEntitlement(ticket, trustedNow) {
  if (!ticket || !Number.isSafeInteger(trustedNow) || trustedNow < 0) {
    throw new TypeError('ticket and valid trustedNow timestamp are required');
  }
  if (trustedNow < ticket.startsAt) {
    return { active: false, state: 'not_started', expiresAt: ticket.expiresAt };
  }
  if (trustedNow >= ticket.expiresAt) {
    return { active: false, state: 'expired', expiresAt: ticket.expiresAt };
  }
  return {
    active: true,
    state: 'active',
    expiresAt: ticket.expiresAt,
    remainingMs: ticket.expiresAt - trustedNow,
  };
}

module.exports = { createEntitlement, evaluateEntitlement };
