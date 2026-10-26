# B-Live-Inspired Time-Based Access Architecture

## What is known, and what is not

Safaricom's public B-Live material describes a time-based browsing product: access is sold for a duration rather than a fixed MB/GB quantity. The public materials do **not** publish Safaricom's proprietary source code, charging-system configuration, packet-gateway rules, or internal APIs. This document therefore translates the publicly visible product model into an independent, testable architecture; it does not claim to reproduce Safaricom's private implementation.

Reference: Safaricom's public B-Live announcement (20 August 2025), distributed at https://www.publicnow.com/view/2A048EAF8BBBC9EEE57F2F6C651515F67F255CD3

## Core lesson from B-Live

The important innovation is not a countdown screen. It is that the operator's **network-side charging and policy enforcement** treat an active subscriber session as valid for a time window. A standalone app cannot achieve this merely by changing its local timer or by buying an ordinary finite consumer bundle.

## Independent implementation plan

1. **Purchase service** — accept a package ID, initiate M-PESA payment, and grant nothing until the provider confirms the transaction and the amount matches the server-side package.
2. **Authoritative entitlement** — persist the start and expiry timestamps on the server. Never trust a device clock or client-supplied expiry.
3. **Admission controller** — place a valid lease only on an enrolled, authorized uplink with available capacity. Refuse admission when no eligible upstream exists.
4. **Controlled traffic gateway (not yet implemented)** — route customer packets through an authorized upstream and enforce the lease at the packet path. Re-check entitlement and revoke the session at expiry. A signed token by itself is not a VPN or gateway.
5. **Supply contract and capacity** — use a provider plan that explicitly permits the intended traffic and resale/shared-access model. Document fair-use rules, speed controls, concurrency, and upstream costs.
6. **Proof tests** — test real HTTPS traffic, then a substantial transfer, measure data usage, verify continued access during the lease, and verify traffic is blocked after expiry. Repeat with reconnects and server/device clock changes.

## Non-negotiable boundary

Do not route or redistribute a consumer B-Live purchase as a workaround: publicly reported product restrictions include no hotspot/tethering and no transfer to other users. Do not bypass operator charging, bundle limits, or network controls. The correct path is to obtain an authorized wholesale/reseller/partner supply arrangement or another lawful upstream designed for shared access.

## Current implementation mapping

- `src/purchase.js`: payment orchestration and provider confirmation.
- `src/access-token.js`: signed time-limited authorization token; control-plane only.
- `src/uplink-pool.js`: admission decisions for authorized uplinks; scheduler prototype only.
- `TIME_LEASE_MULTIPATH_POOL.md`: pooling and failover design.
- Missing critical production component: a real controlled traffic gateway connected to an authorized upstream, with packet-level expiry enforcement and end-to-end traffic tests.

## Acceptance criteria for a real breakthrough

- An authorized upstream contract/configuration exists and permits the use case.
- Successful payment activates the entitlement exactly once.
- Multiple traffic volumes work until server-side expiry, subject to disclosed fair-use limits.
- Expired users lose access through the actual gateway, not just the UI.
- Independent tests prove traffic is carried through the controlled route and cannot bypass expiry.
- Price and duration are supported by measured upstream economics before being offered commercially.

Until these gates pass, describe this as an engineering prototype, not unlimited internet service.
