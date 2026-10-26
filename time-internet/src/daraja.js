'use strict';

function requiredEnv(env, key) {
  const value = env[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[\s+()-]/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  throw new TypeError('Enter a valid Kenyan Safaricom-format mobile number');
}

function formatDarajaTimestamp(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function createDarajaClient({ env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const baseUrl = (env.DARAJA_BASE_URL || 'https://sandbox.safaricom.co.ke').replace(/\/$/, '');

  async function getAccessToken() {
    const key = requiredEnv(env, 'DARAJA_CONSUMER_KEY');
    const secret = requiredEnv(env, 'DARAJA_CONSUMER_SECRET');
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const response = await fetchImpl(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      throw new Error(`Daraja token request failed (HTTP ${response.status})`);
    }
    return body.access_token;
  }

  async function queryStkPush({ checkoutRequestId }) {
    if (typeof checkoutRequestId !== 'string' || !checkoutRequestId.trim()) {
      throw new TypeError('checkoutRequestId is required');
    }
    const shortcode = requiredEnv(env, 'DARAJA_SHORTCODE');
    const passkey = requiredEnv(env, 'DARAJA_PASSKEY');
    const timestamp = formatDarajaTimestamp(now());
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const token = await getAccessToken();
    const response = await fetchImpl(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Daraja STK query failed (HTTP ${response.status})`);
    return body;
  }

  async function initiateStkPush({ phone, amountKes, accountReference, transactionDesc }) {
    if (!Number.isSafeInteger(amountKes) || amountKes < 1) {
      throw new TypeError('amountKes must be a positive integer');
    }
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(String(accountReference || ''))) {
      throw new TypeError('accountReference must be 1-12 letters, digits, underscores or hyphens');
    }

    const shortcode = requiredEnv(env, 'DARAJA_SHORTCODE');
    const passkey = requiredEnv(env, 'DARAJA_PASSKEY');
    const callbackUrl = requiredEnv(env, 'DARAJA_CALLBACK_URL');
    const timestamp = formatDarajaTimestamp(now());
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
    const token = await getAccessToken();

    const response = await fetchImpl(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: env.DARAJA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
        Amount: amountKes,
        PartyA: normalizePhone(phone),
        PartyB: shortcode,
        PhoneNumber: normalizePhone(phone),
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: String(transactionDesc || 'Timed internet access').slice(0, 13),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ResponseCode !== '0' || !body.CheckoutRequestID) {
      throw new Error(`Daraja STK Push request failed (HTTP ${response.status})`);
    }

    return {
      merchantRequestId: body.MerchantRequestID || null,
      checkoutRequestId: body.CheckoutRequestID,
      responseDescription: body.ResponseDescription || 'STK Push requested',
      customerMessage: body.CustomerMessage || 'Check your phone to complete M-PESA payment',
    };
  }

  return { initiateStkPush, queryStkPush };
}

module.exports = { createDarajaClient, normalizePhone, formatDarajaTimestamp };
