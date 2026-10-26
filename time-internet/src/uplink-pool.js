/**
 * Time-lease uplink pool scheduler (prototype).
 *
 * This module does not create internet connectivity. It selects among explicitly
 * enrolled, authorized uplinks and keeps access policy time-based, not byte-based.
 * A production gateway must enforce the returned route and expiry on real packets.
 */

export function createPool(uplinks = []) {
  const state = new Map();
  for (const uplink of uplinks) {
    if (!uplink || typeof uplink.id !== 'string' || !uplink.id.trim()) {
      throw new TypeError('Each uplink needs a non-empty id');
    }
    if (!Number.isFinite(uplink.capacityMbps) || uplink.capacityMbps <= 0) {
      throw new TypeError('Each uplink needs positive capacityMbps');
    }
    if (state.has(uplink.id)) throw new Error(`Duplicate uplink id: ${uplink.id}`);
    state.set(uplink.id, {
      id: uplink.id,
      capacityMbps: uplink.capacityMbps,
      active: uplink.active !== false,
      authorized: uplink.authorized === true,
      maxSessions: Number.isInteger(uplink.maxSessions) && uplink.maxSessions > 0
        ? uplink.maxSessions : Infinity,
      sessions: new Set(),
    });
  }
  return state;
}

/**
 * Enrolls a paid time lease onto the least-loaded eligible uplink.
 * No byte counter is consulted or created. Each lease expires at expiresAt.
 */
export function admitLease(pool, lease, now = Date.now()) {
  if (!(pool instanceof Map)) throw new TypeError('pool must be a pool Map');
  if (!lease || typeof lease.id !== 'string' || !lease.id.trim()) {
    throw new TypeError('lease.id is required');
  }
  if (!Number.isFinite(lease.expiresAt) || lease.expiresAt <= now) {
    throw new Error('Lease must have a future expiresAt');
  }
  for (const uplink of pool.values()) {
    if (uplink.sessions.has(lease.id)) throw new Error('Lease already admitted');
  }

  const candidates = [...pool.values()]
    .filter(u => u.active && u.authorized && u.sessions.size < u.maxSessions)
    .sort((a, b) => {
      const loadA = a.sessions.size / a.capacityMbps;
      const loadB = b.sessions.size / b.capacityMbps;
      return loadA - loadB || a.id.localeCompare(b.id);
    });

  if (!candidates.length) throw new Error('No authorized uplink capacity available');
  const chosen = candidates[0];
  chosen.sessions.add(lease.id);
  leaseIdExpiry.set(lease.id, lease.expiresAt);
  return Object.freeze({
    leaseId: lease.id,
    uplinkId: chosen.id,
    expiresAt: lease.expiresAt,
    policy: 'time-only',
  });
}

/** Returns active route only while its time lease remains valid. */
export function authorizeTraffic(pool, route, now = Date.now()) {
  if (!route || typeof route.leaseId !== 'string' ||
      typeof route.uplinkId !== 'string' || !Number.isFinite(route.expiresAt)) {
    return false;
  }
  if (now >= route.expiresAt) return false;
  const uplink = pool.get(route.uplinkId);
  return Boolean(uplink && uplink.active && uplink.authorized &&
    uplink.sessions.has(route.leaseId));
}

/** Remove expired/invalid sessions; call from gateway reconciliation. */
export function reconcilePool(pool, now = Date.now()) {
  let removed = 0;
  for (const uplink of pool.values()) {
    for (const leaseId of [...uplink.sessions]) {
      const expiry = leaseIdExpiry.get(leaseId);
      if (!uplink.active || !uplink.authorized || (expiry !== undefined && now >= expiry)) {
        uplink.sessions.delete(leaseId);
        leaseIdExpiry.delete(leaseId);
        removed++;
      }
    }
  }
  return removed;
}

// Internal expiry registry is populated by admitLease and intentionally not exposed.
const leaseIdExpiry = new Map();
