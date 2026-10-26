# Time-Lease Multipath Pool (TLMP) — invention workbench

## The proposed mechanism

The user buys a *time lease*, not a byte bucket. A controlled gateway admits that lease to an eligible pool of independently authorized uplinks. The scheduler chooses the least-loaded eligible uplink; the gateway checks lease expiry on the actual packet path. When one uplink fails, a gateway may re-route the session to another eligible uplink without resetting the lease clock.

The novel product behaviour to investigate is the combination of:
- **Time-only entitlement:** no customer data allowance is stored in the lease.
- **Uplink pooling:** multiple permitted uplinks are treated as one service pool, instead of binding a user to a single source.
- **Capacity-aware admission:** do not promise a session if no enrolled uplink is eligible.
- **Continuity:** a route may change while the original expiry remains fixed.
- **Hard expiry:** traffic authorization is denied at `now >= expiresAt`, and the gateway must remove the user's routes/firewall state.

This is an architecture hypothesis and prototype, not a claim that a new radio protocol or free energy source has been invented. It cannot create capacity where no uplink exists, defeat an upstream provider's data cap, or make ordinary cellular service unlimited. The commercial promise is valid only if the upstream supply agreement/cost structure supports the sold time lease.

## Prototype module

`src/uplink-pool.js` implements the first deterministic admission-policy slice. It accepts only explicitly authorized uplinks, selects the least-loaded eligible uplink, issues a time-only route descriptor, denies traffic at expiry, and reconciles expired sessions. `src/uplink-pool.test.js` covers authorization, no-capacity rejection, duplicate leases, exact expiry, and route invalidation.

## What remains before a real-world proof

1. **Transport:** implement a real gateway dataplane (e.g. Linux routing/NAT plus WireGuard or equivalent) and bind each lease to an authenticated device/session.
2. **Pool agents:** enroll only uplinks whose owners and upstream terms explicitly permit sharing; measure health, throughput, latency, and real costs.
3. **Safe switching:** implement connection tracking and route failover without extending the lease or bypassing upstream policies.
4. **Payment boundary:** activate only after independently reconciled M-PESA success; make callback processing idempotent.
5. **Real test:** pay a small sandbox/approved test transaction, pass ordinary HTTP/HTTPS traffic through the gateway, record counters at the upstream and gateway, switch uplinks, and verify packets are denied at expiry.
6. **Economic proof:** measure pooled capacity and cost per active user. “Unlimited volume” cannot mean infinite throughput; it means no product-level byte quota during the valid time window, subject to transparent fair-use and capacity limits.

## Safety and claims

Never use a consumer bundle in a way that evades its quota/terms. Never display “unlimited” to customers until an authorized upstream and actual packet-path enforcement pass the acceptance test. CI tests of this scheduler prove only its software policy; they do not prove end-to-end internet delivery.
