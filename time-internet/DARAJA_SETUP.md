# Safaricom / M-PESA integration setup

Official developer portal: https://developer.safaricom.co.ke/

Safaricom's Daraja APIs support payment integration, including customer-initiated M-PESA payment prompts. A successful payment only proves payment; it does not provide or authorize internet connectivity.

## Sandbox configuration

The adapter defaults to Safaricom's sandbox. Configure secrets only in a private server environment, never in Android app code or Git:

- `DARAJA_BASE_URL=https://sandbox.safaricom.co.ke`
- `DARAJA_CONSUMER_KEY`
- `DARAJA_CONSUMER_SECRET`
- `DARAJA_SHORTCODE`
- `DARAJA_PASSKEY`
- `DARAJA_CALLBACK_URL` (public HTTPS endpoint controlled by this project)
- Optional: `DARAJA_TRANSACTION_TYPE`

The STK adapter is implemented in `src/daraja.js`. It requests an OAuth token and sends an STK Push request. Automated tests mock the HTTP calls and do not move real money.

## Before live payments

1. Register and create an app in the official Daraja portal.
2. Complete Safaricom's required onboarding/approval for the applicable shortcode and API product.
3. Implement a durable database-backed payment store and public HTTPS callback endpoint.
4. Match each callback to a stored CheckoutRequestID and independently verify transaction status, amount, shortcode, and receipt using the appropriate Daraja API before issuing an entitlement.
5. Make callback handling idempotent; handle duplicate, delayed, cancelled, failed, and ambiguous payments.
6. Configure monitoring, rate limits, audit trails, reconciliation, refunds/support procedures, and secrets rotation.
7. Keep the product disabled for real sales until all end-to-end tests pass.

## Critical: internet supply is not yet integrated

This branch does not buy or activate Safaricom data bundles and does not transform a purchased bundle into unlimited traffic. The payment adapter only initiates an M-PESA payment prompt. To fulfil the proposed service, the project still needs an authorized internet supply and traffic-enforcement arrangement that permits time-based access without a per-customer volume cutoff. Do not claim unlimited access until this is proven with real traffic and the provider terms support it.
