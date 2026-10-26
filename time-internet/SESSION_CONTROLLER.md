# Time-session controller

`src/session-controller.js` is the control-plane orchestration layer between a trusted entitlement record and a gateway adapter.

## Integration contract

The API/server integration must:
1. Verify the payment using the provider's server-side status/callback verification; never accept a client assertion that payment succeeded.
2. Load the entitlement from trusted storage and derive its expiry server-side.
3. Bind the entitlement to the authenticated user and resolve the IPv4 address from the authenticated VPN tunnel, not from a public request parameter.
4. Call `activate({ entitlement, uplink, clientIp })` with the server's current time and a selected upstream whose authorization, health, and capacity were checked server-side.
5. Report “connected” only when the gateway's `grant` method succeeds.
6. Call `deactivate(entitlementId)` for user disconnect, refunds/chargebacks, abuse actions, or administrative termination. Retry and alert if gateway revocation fails.
7. Reconcile active leases against persisted entitlements and gateway state after restarts. The in-memory map is process-local and is not a production database.

## Safety and failure behaviour

- Denies leases that have not started or have expired.
- Fails closed if the upstream is not explicitly authorized, ready, or has capacity.
- Does not mark a session active before gateway grant succeeds.
- Preserves local state when gateway revocation fails so a caller can retry.
- Uses server time; do not accept device time or a client-provided `expiresAt`.

## Not yet production-ready

This controller is not a payment webhook, database, Android VPN service, or full network gateway. The nftables adapter is only one gateway component. Production readiness requires durable storage, authenticated API routes, idempotent payment handling, secure client-to-gateway tunnel provisioning, firewall rules that enforce the timed set for all relevant traffic (including IPv6/DNS), operational monitoring, and live traffic tests on an authorized upstream.
