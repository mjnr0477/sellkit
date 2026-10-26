Internet supply track — Safaricom first

## What this project must prove

The app can sell a timed entitlement, but the customer still needs a real traffic path. A standard Safaricom consumer data bundle remains subject to the bundle terms and allowance; software on the phone cannot legitimately convert that finite allowance into unlimited traffic by changing a local counter.

The intended model requires an upstream supply arrangement that actually permits the traffic and commercial resale/access model, for example an approved wholesale connectivity agreement or another authorized service that offers capacity without a per-customer data-volume allowance.

## Safaricom lead

Safaricom publishes a wholesale connectivity offering and wholesale sales contact information:

- Official page: https://www.safaricom.co.ke/wholesale/about/
- Wholesale enquiries: wholesale@safaricom.co.ke

We have not contacted Safaricom, obtained an agreement, or confirmed a wholesale price. Do not represent the project as a Safaricom partner until written authorization exists.

## Questions that must be answered before real users

1. Can Safaricom supply a fixed-cost/time-based internet service or wholesale capacity for this use case?
2. Are resale, shared access, VPN/tunnel routing, and end-user distribution permitted by the agreement?
3. What are the actual capacity, fair-use, speed, geographic, and concurrent-user limits?
4. How is each customer authenticated and disconnected at ticket expiry?
5. What does capacity cost per hour at realistic usage, and can the chosen ticket price cover it?

## Engineering proof

The signed access token in src/access-token.js is a control-plane building block. It is not a traffic tunnel or gateway by itself. A production gateway must validate the signed token and actively enforce its expiry on the actual packet path. This branch does not yet include that gateway or a connected internet supply.

Do not advertise “unlimited” or accept live customer payments until an authorized supply route has been connected and tested with substantial real traffic.
