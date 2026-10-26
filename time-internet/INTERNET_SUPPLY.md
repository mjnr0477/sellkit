# Internet supply and Android client track — Safaricom first

## Required customer experience

A customer buys connectivity through an official channel, starts Sellkit once, and can then use other Android apps while the connection remains active. Sellkit should show connection state, time remaining, data/speed policy, and a clear disconnect control.

**This UX is technically feasible; turning a normal metered consumer bundle into unlimited data by tunnelling it is not.** A VPN changes the route of packets, not the carrier's accounting. If traffic exits through the customer's own Safaricom SIM and bundle, it will ordinarily still be counted under that bundle and its terms.

## Supported supply models to investigate

1. **Safaricom-authorized wholesale or reseller capacity.** Negotiate written permission for shared/tunnelled access, resale, user authentication, expiry enforcement, capacity, and fair-use terms. Safaricom's published wholesale page lists the sales contact:
   - https://www.safaricom.co.ke/wholesale/about/
   - wholesale@safaricom.co.ke
2. **Safaricom enterprise sponsored/bulk data.** Safaricom's Your Saf Connect Hub advertises sponsored browsing and bulk-data tools for eligible enterprise customers: https://ysconnecthub.safaricom.co.ke/. Apply and confirm eligibility, pricing, permitted destinations, usage caps, and whether general internet traffic through a VPN is allowed. Sponsored-data programmes may cover only approved services/domains; do not assume they provide unrestricted internet.
3. **A separately authorized upstream connection.** Route customer traffic through a gateway with a supply agreement whose capacity and price support the advertised package. If a customer buys a normal Safaricom bundle, that purchase alone does not grant Sellkit permission to resell or tunnel it for other users.

## B-Live constraint

Safaricom's B-Live is already a time-based consumer product, but public reporting of Safaricom's guidance says it cannot be shared by hotspot/tethering. Sellkit must not try to bypass that restriction or present B-Live as an authorized upstream for a resale/tunnel service. Check the current offer and terms directly with Safaricom before relying on any consumer bundle.

## Android background behaviour

For the requested whole-device experience, the Android client should use Android's `VpnService` API to create a user-approved VPN interface and route traffic through an authenticated gateway. Android requires the VPN permission/consent flow. The active VPN should run as a foreground service with a persistent system notification; it must not be presented as an invisible service. Handle reconnects, network changes, battery restrictions, DNS, IPv4/IPv6, app exclusions, and user disconnects. A tunnel client alone does not provide upstream internet.

## Gateway prototype status

- `src/nft-lease-gateway.js` is a prototype adapter that grants/revokes IPv4 client leases in a preconfigured Linux nftables set.
- It is not a complete gateway: no live tunnel, Android VPN client, upstream connectivity, production provisioning, NAT/DNS/IPv6 policy, or end-to-end traffic test has been demonstrated.
- CI run for the current prototype commit: https://github.com/mjnr0477/sellkit/actions/runs/40301436089 (check result before describing this build as verified).
- The signed token in `src/access-token.js` is a control-plane building block; it does not itself carry packets.

## Acceptance gates before selling

1. Written upstream authorization that explicitly covers this routing/resale use case.
2. Unit and integration tests for payment confirmation, identity, expiry, revocation, gateway failure, and abuse controls.
3. An Android VPN client that routes ordinary app traffic through the gateway while the app is backgrounded, with user consent and a visible persistent notification.
4. Real end-to-end traffic tests on a controlled, authorized uplink, including reconnect, DNS, IPv6 leak checks, lease expiry, concurrent users, and load.
5. Transparent package terms: what “unlimited” means, fair-use/speed limits, duration, and availability.
6. Do not advertise unlimited or accept live customer payments until the upstream and complete packet path have been verified.
