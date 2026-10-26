# Time-Based Internet Access — Fresh Invention Track

## Product hypothesis

A customer purchases an access entitlement defined by time, not by a fixed number of megabytes or gigabytes. Example: KSh 10 buys 12 hours of internet access. During the active window, ordinary internet activity does not exhaust the entitlement; access ends at the expiry time.

## Non-negotiable product rules

1. The entitlement clock—not a data-volume balance—determines expiry.
2. Do not claim "unlimited internet" unless the tested delivery path genuinely has no per-customer data-volume cutoff during the entitlement.
3. Do not disguise a conventional bundle, a capped trial, or a local timer as the invention.
4. Do not bypass a mobile operator's billing, access controls, or terms. The supply path must be authorized.
5. Keep this invention isolated in its own directory and branch. Do not reuse or edit previous Sellkit experiments.
6. Target Android-phone-first testing, with no desktop computer required by the user.

## System boundary

The invention has two separate parts:

- **Entitlement engine:** payment confirmation, start time, expiry time, session state, and access policy.
- **Traffic supply path:** the actual authorized network route that carries packets to and from the public internet.

The entitlement engine can enforce time. It cannot create bandwidth or turn a finite mobile-data allowance into unlimited upstream capacity by itself. A real proof must validate both parts together.

## First proof target

Prove or disprove a real end-to-end path that allows a phone to use ordinary internet traffic for a timed session without a data-volume cutoff, while the access entitlement expires on schedule. A status screen or timer alone is not proof.

## Evidence required before calling it successful

- Exact Android device and network conditions recorded.
- Ordinary HTTPS requests succeed during the session.
- Actual upstream/supply model identified and authorized.
- Data-volume consumption is measured for the test, including a high-volume transfer where feasible.
- The session remains authorized after substantial usage, then is denied after expiry.
- No claim of carrier-billing bypass or free/unlimited connectivity based only on signal bars or a successful small request.

## Current status

Fresh branch and isolated design record created. No end-to-end unlimited supply path has yet been proven. The next implementation step is a small Android-first validation prototype and a reproducible test protocol, kept separate from any prior Sellkit work.
