# Proof Protocol v1 — Time-Based Internet

This protocol is designed to test the central claim, not merely demonstrate a countdown timer.

## Hypothesis

A paid entitlement can remain valid for a configured duration while the customer transfers differing amounts of internet data, and it expires based on time rather than transferred volume.

## Test stages

### Stage A — Connectivity truth
Record whether Android is on Wi-Fi or cellular, whether the system reports internet capability, and whether a real HTTPS endpoint can be reached. These are distinct facts. Signal bars alone do not count.

### Stage B — Entitlement clock
Create a test entitlement with a short duration. Record server-authoritative start and expiry timestamps. Changing the phone clock must not extend the entitlement. Reopening the app must not reset it.

### Stage C — Usage independence
On an authorized test connection, transfer a measured small amount, then a larger amount. Verify that entitlement status remains active based on time. Record any provider bundle limits or throttling honestly; do not infer unlimited service from a small transfer.

### Stage D — Expiry enforcement
At expiry, the system must stop granting access through the controlled access path. Test requests before and after expiry. Document enforcement delay and behavior if the phone is offline when expiry occurs.

### Stage E — Real supply economics
Identify who carries the traffic, what capacity is purchased, the permitted resale/redistribution terms, and the cost per active user under realistic usage. The price cannot be declared viable until these are measured.

## Pass criteria

- A server-authoritative entitlement starts and expires at the expected times.
- Entitlement does not expire early due to bytes consumed.
- Expired sessions are denied by the actual controlled traffic path, not just hidden by the app UI.
- Test traffic reaches the public internet.
- The supply path is authorized and its limitations are disclosed.
- Tests cover at least one substantial transfer; "unlimited" remains unproven until the upstream terms and capacity support it.

## Fail criteria

- Only a timer UI works.
- Only a small HTTPS ping succeeds.
- Connectivity depends on a conventional finite bundle that is exhausted during the test.
- The app reports success while packets still bypass its access control, or reports access blocked while the upstream path remains usable.
- The mechanism relies on bypassing operator charging or access restrictions.

## Safety and honesty

Use only a connection and network service the tester is authorized to use. Do not attempt to evade carrier charging or access controls. A successful timer prototype is not evidence of an unlimited internet supply model.
