/**
 * Control-plane orchestration for a paid time lease.
 *
 * The caller must load the entitlement from trusted storage, verify payment
 * server-side, resolve the client IP from the authenticated tunnel, and supply
 * a trusted server timestamp. This controller never trusts client-supplied
 * expiry values and never creates upstream connectivity.
 */
import sessionPolicy from './session-policy.js';

const { decideSessionAdmission } = sessionPolicy;

export function createSessionController({ gateway, clock = () => Date.now() } = {}) {
  if (!gateway || typeof gateway.grant !== 'function' || typeof gateway.revoke !== 'function') {
    throw new TypeError('A gateway with grant and revoke methods is required');
  }
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  const active = new Map();

  async function activate({ entitlement, uplink, clientIp }) {
    if (!entitlement || typeof entitlement.id !== 'string' || !entitlement.id.trim()) {
      throw new TypeError('A server-loaded entitlement with an id is required');
    }
    if (typeof clientIp !== 'string' || !clientIp.trim()) {
      throw new TypeError('An authenticated tunnel client IP is required');
    }
    const now = clock();
    const decision = decideSessionAdmission({ entitlement, trustedNow: now, uplink });
    if (!decision.admitted) {
      return Object.freeze({ admitted: false, reason: decision.reason, expiresAt: decision.expiresAt });
    }
    if (active.has(entitlement.id)) {
      return Object.freeze({ admitted: false, reason: 'session_already_active', expiresAt: decision.expiresAt });
    }

    // Grant only after policy validation. Store state only after the gateway
    // confirms success, so a failed firewall operation cannot look connected.
    const lease = await gateway.grant(clientIp, decision.expiresAt, now);
    const record = Object.freeze({
      entitlementId: entitlement.id,
      clientIp,
      expiresAt: decision.expiresAt,
      lease,
    });
    active.set(entitlement.id, record);
    return Object.freeze({
      admitted: true,
      reason: 'active',
      entitlementId: entitlement.id,
      expiresAt: decision.expiresAt,
      remainingMs: decision.remainingMs,
      enforcement: lease.enforcement || 'gateway-confirmed',
    });
  }

  async function deactivate(entitlementId) {
    if (typeof entitlementId !== 'string' || !entitlementId.trim()) {
      throw new TypeError('entitlementId is required');
    }
    const record = active.get(entitlementId);
    if (!record) return Object.freeze({ revoked: false, reason: 'session_not_active' });
    // Keep record until revoke succeeds; caller can retry if the gateway fails.
    await gateway.revoke(record.clientIp);
    active.delete(entitlementId);
    return Object.freeze({ revoked: true, entitlementId });
  }

  function inspect(entitlementId) {
    const record = active.get(entitlementId);
    if (!record) return null;
    return Object.freeze({
      entitlementId: record.entitlementId,
      clientIp: record.clientIp,
      expiresAt: record.expiresAt,
      expired: clock() >= record.expiresAt,
    });
  }

  return Object.freeze({ activate, deactivate, inspect });
}
