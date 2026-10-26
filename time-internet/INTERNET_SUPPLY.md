# Internet supply and Android client track — Safaricom first

## Required customer experience

A customer buys connectivity through an official channel, starts Sellkit once, and can then use other Android apps while the connection remains active. Sellkit should show connection state, time remaining, data/speed policy, and a clear disconnect control.

**This UX is technically feasible; turning a normal metered consumer bundle into unlimited data by tunnelling it is not.** A VPN changes the route of packets, not the carrier's accounting. If traffic exits through the customer's own Safaricom SIM and bundle, it will ordinarily still be counted under that bundle and its terms.

## Supply options supported by current official information

1. **Wholesale or reseller capacity.** Safaricom publishes wholesale connectivity, leased capacity and IP transit offerings. Request written permission for resale/shared access, VPN/tunnel routing, user authentication, expiry enforcement, capacity and fair-use terms:
   - https://www.safaricom.co.ke/wholesale/about/
   - wholesale@safaricom.co.ke
   - https://www.safaricom.co.ke/wholesale/wholesale_products/supports-ipv4ipv6-dual-stack/

2. **Sponsored data for Sellkit's own service.** Safaricom's Your Saf Connect Hub advertises sponsored browsing and bulk data for eligible enterprise customers: https://ysconnecthub.safaricom.co.ke/. Safaricom's official Sponsored Data FAQ says provision is tied to an online resource's URL and IP address, requires a static IP, warns that embedded third-party links may leave the sponsored resource, and documents a conditional monthly access fee/minimum spend of KES 50,000 plus daily per-user MB limits. Source: https://www.safaricom.co.ke/media-center-landing/frequently-asked-questions/sponsored-data-solution.
   
   **Implication:** this may be useful to make the Sellkit website/app service itself accessible under an approved sponsored-data arrangement. It is not evidence of unrestricted general internet for every phone app, and the fee/terms must be confirmed before budgeting.

3. **Separately authorized upstream internet.** Route traffic through a gateway whose supply agreement and cost actually support the advertised package. A customer buying an ordinary Safaricom consumer bundle does not, by itself, authorize Sellkit to resell or tunnel that bundle for other users.

## B-Live constraint

Safaricom's B-Live is a time-based consumer product, but public reporting of Safaricom's guidance says it cannot be shared by hotspot/tethering. Sellkit must not bypass that restriction or present B-Live as an authorized upstream for a resale/tunnel service. Verify current terms directly with Safaricom.

## Android background behaviour

For whole-device routing, the Android client should use Android's `VpnService` API to create a user-approved VPN interface and route traffic through an authenticated gateway. The active VPN should run as a foreground service with a persistent system notification, not invisibly. Handle reconnects, network changes, battery restrictions, DNS, IPv4/IPv6, app exclusions and user disconnects. A tunnel client alone does not provide upstream internet.

## Gateway prototype status

- `src/nft-lease-gateway.js` is a prototype adapter that grants/revokes IPv4 client leases in a preconfigured Linux nftables set.
- It is not a complete gateway: no live tunnel, Android VPN client, upstream connectivity, production provisioning, NAT/DNS/IPv6 policy or end-to-end traffic test has been demonstrated.
- Gateway prototype CI run: https://github.com/mjnr0477/sellkit/actions/runs/40301436089.
- The signed token in `src/access-token.js` is a control-plane building block; it does not carry packets.

## Acceptance gates before selling

1. Written upstream authorization covering this routing/resale use case.
2. Unit and integration tests for payment confirmation, identity, expiry, revocation, gateway failure and abuse controls.
3. Android VPN client routing ordinary app traffic through the gateway in background, with user consent and persistent notification.
4. Real end-to-end traffic tests on a controlled, authorized uplink: reconnect, DNS, IPv6 leak checks, expiry, concurrent users and load.
5. Transparent package terms defining duration, speed/fair-use limits and availability.
6. Do not advertise unlimited or accept live customer payments until upstream and the full packet path have been verified.
