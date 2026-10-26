'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDarajaClient, normalizePhone, formatDarajaTimestamp } = require('./daraja');

test('normalizes common Kenyan mobile number formats', () => {
  assert.equal(normalizePhone('0712345678'), '254712345678');
  assert.equal(normalizePhone('712345678'), '254712345678');
  assert.equal(normalizePhone('+254 712 345 678'), '254712345678');
});

test('rejects invalid phone numbers', () => {
  assert.throws(() => normalizePhone('12345'), /valid Kenyan/);
});

test('does not send a payment without required Daraja configuration', async () => {
  const client = createDarajaClient({ env: {}, fetchImpl: async () => { throw new Error('should not call network'); } });
  await assert.rejects(
    client.initiateStkPush({ phone: '0712345678', amountKes: 10, accountReference: 'ticket_1' }),
    /DARAJA_SHORTCODE/,
  );
});

test('rejects invalid amount before making a network request', async () => {
  const client = createDarajaClient({ env: {}, fetchImpl: async () => { throw new Error('should not call network'); } });
  await assert.rejects(
    client.initiateStkPush({ phone: '0712345678', amountKes: 0, accountReference: 'ticket_1' }),
    /positive integer/,
  );
});

test('formats the STK timestamp in the Nairobi time zone', () => {
  assert.equal(formatDarajaTimestamp(new Date('2026-10-26T09:00:00.000Z')), '20261026120000');
});

test('sends a correctly shaped STK Push request when sandbox credentials are configured', async () => {
  const calls = [];
  const env = {
    DARAJA_BASE_URL: 'https://sandbox.safaricom.co.ke',
    DARAJA_CONSUMER_KEY: 'test-key',
    DARAJA_CONSUMER_SECRET: 'test-secret',
    DARAJA_SHORTCODE: '174379',
    DARAJA_PASSKEY: 'test-passkey',
    DARAJA_CALLBACK_URL: 'https://example.invalid/callback',
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('/oauth/v1/generate')) {
      return { ok: true, status: 200, async json() { return { access_token: 'sandbox-token' }; } };
    }
    return {
      ok: true, status: 200,
      async json() { return { ResponseCode: '0', CheckoutRequestID: 'ws_CO_TEST', CustomerMessage: 'Prompt sent' }; },
    };
  };
  const client = createDarajaClient({
    env, fetchImpl, now: () => new Date('2026-10-26T09:00:00.000Z'),
  });
  const result = await client.initiateStkPush({
    phone: '0712345678', amountKes: 10, accountReference: 'ticket_1',
  });
  assert.equal(result.checkoutRequestId, 'ws_CO_TEST');
  assert.equal(calls.length, 2);
  const payload = JSON.parse(calls[1].options.body);
  assert.equal(payload.Timestamp, '20261026120000');
  assert.equal(payload.Amount, 10);
  assert.equal(payload.PhoneNumber, '254712345678');
  assert.equal(payload.CallBackURL, env.DARAJA_CALLBACK_URL);
});

test('queries a stored STK transaction status through Daraja', async () => {
  const calls = [];
  const env = {
    DARAJA_BASE_URL: 'https://sandbox.safaricom.co.ke',
    DARAJA_CONSUMER_KEY: 'test-key',
    DARAJA_CONSUMER_SECRET: 'test-secret',
    DARAJA_SHORTCODE: '174379',
    DARAJA_PASSKEY: 'test-passkey',
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('/oauth/v1/generate')) {
      return { ok: true, status: 200, async json() { return { access_token: 'sandbox-token' }; } };
    }
    return { ok: true, status: 200, async json() { return { ResultCode: '0', ResultDesc: 'The service request is processed successfully.' }; } };
  };
  const client = createDarajaClient({ env, fetchImpl, now: () => new Date('2026-10-26T09:00:00.000Z') });
  const result = await client.queryStkPush({ checkoutRequestId: 'ws_CO_TEST' });
  assert.equal(result.ResultCode, '0');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.endsWith('/mpesa/stkpushquery/v1/query'));
  assert.equal(JSON.parse(calls[1].options.body).CheckoutRequestID, 'ws_CO_TEST');
});
