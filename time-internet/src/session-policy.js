/**
 * Network-side admission policy inspired by the public time-based access model.
 *
 * This is a control-plane decision only. A real gateway must apply the decision
 * to packets; callers must supply a trusted server timestamp and verified
 * uplink state. This module does not create connectivity or carrier exemptions.
 */
'use strict';

const { evaluateEntitlement } = require('./entitlement');

function decideSessionAdmission({ entitlement, trustedNow, uplink }) {
  if (!entitlement || !uplink || !Number.isSafeInteger(trustedNow) || trustedNow < 0) {
    throw new TypeError('entitlement, trustedNow, and uplink are required');
  }

  const lease = evaluateEntitlement(entitlement, trustedNow);
  if (!lease.active) {
    return Object.freeze({
      admitted: false,
      reason: lease.state,
      expiresAt: lease.expiresAt,
    });
  }

  if (uplink.authorized !== true) {
    return Object.freeze({ admitted: false, reason: 'upstream_not_authorized', expiresAt: lease.expiresAt });
  }
  if (uplink.ready !== true) {
    return Object.freeze({ admitted: false, reason: 'upstream_unavailable', expiresAt: lease.expiresAt });
  }
  if (uplink.capacityAvailable !== true) {
    return Object.freeze({ admitted: false, reason: 'capacity_unavailable', expiresAt: lease.expiresAt });
  }

  return Object.freeze({
    admitted: true,
    reason: 'active',
    expiresAt: lease.expiresAt,
    remainingMs: lease.remainingMs,
    policy: 'time-only',
  });
}

module.exports = { decideSessionAdmission };
