# SellKit package-session readiness plan

## Current verified baseline
- Android diagnostic prototype: `com.sellkit.signallab`.
- Existing package buttons are explicitly non-transactional; they must not imply that a bundle was purchased or activated.
- The debug APK workflow passed for commit `2f8ea6ae9ba69c6915986f312481d46f896b6ae8`.
- A successful Android build proves the APK compiles, not that Safaricom data is free or that a session is provisioned.

## Product target
Offer a clearly priced, time-limited access product only after an actual network-access path and provisioning authority exist:
- KSh 5 / 6 hours
- KSh 10 / 12 hours
- No undisclosed fees; show any unavoidable carrier or payment charges before confirmation.

## Hard technical boundary
An Android app cannot grant arbitrary internet access on Safaricom merely by running a timer, changing DNS, or testing a URL. A working service needs a legitimate data path (for example, a carrier-approved offer, an explicitly disclosed sponsored-data arrangement, or a real relay/VPN whose upstream connectivity is paid for) and authorization to activate it. A VPN/relay does not make its upstream traffic free. Do not claim “unlimited” until throughput, fair-use limits, destinations, coverage, and session duration are tested and disclosed.

## Required components before launch
1. **Offer catalogue**: server-owned package IDs, KSh prices, duration seconds, availability and terms. Never trust price/duration supplied by the client.
2. **Payment adapter**: server-side payment initiation and verified provider callbacks; idempotency keys; no client-only “payment successful” state.
3. **Entitlement service**: issue a session only after verified payment/eligibility; store start/end timestamps and state transitions; reject replayed callbacks.
4. **Access enforcement**: integrate with the actual authorized data path. If no access provider is configured, return an explicit unavailable state and do not start a countdown.
5. **Status API**: report `unavailable`, `pending_payment`, `active`, `expired`, or `failed`; derive expiry from server time.
6. **Security and privacy**: authenticated APIs, rate limits, secret storage only on the server, minimal personal data, auditable state changes.
7. **Android UX**: explain price, duration, included destinations/limits, renewal behavior and any charges before the user confirms. Do not label a diagnostic test as a free-data test.

## Acceptance tests
- A package selection alone creates no payment, entitlement, or active session.
- Invalid, unsigned, duplicate, delayed, or replayed payment callbacks cannot activate a session.
- A verified successful payment activates exactly one entitlement with the catalogue duration.
- Failed/cancelled payment creates no entitlement.
- Server-side expiry ends the entitlement at the correct timestamp, including after app restart.
- Server clock, not device clock, determines expiry.
- Missing access-provider configuration returns unavailable and never displays “connected” or “unlimited”.
- API errors, no network, app restart, and repeated taps do not duplicate charges or sessions.
- The displayed final price matches the amount actually charged; all extra fees are disclosed before confirmation.
- End-to-end tests demonstrate real browsing through the provisioned path on a Safaricom SIM; ordinary HTTPS reachability alone is not evidence of zero-rating.

## Immediate next engineering step
Inspect and implement the smallest server-backed package catalogue/status API and automated tests first. Keep payment and access activation disabled behind explicit configuration until the provider and authorized access path are present. Do not merge into the default branch or replace the existing diagnostic app until tests pass.
