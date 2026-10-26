'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPurchaseService } = require('./purchase');

function response(status, data) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(data); } };
}

test('creates a pending payment through the Supabase REST API without exposing secrets in URLs', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response(201, [{
      id: 'payment-uuid', user_id: 'user-1', package_id: 'time-12h-kes10',
      amount_kes: 10, reference: 'ticket_123abc', status: 'pending',
      checkout_request_id: null, receipt_number: null, paid_at_ms: null,
    }]);
  };
  const { createSupabaseStore } = require('./supabase-store');
  const store = createSupabaseStore({
    env: { SUPABASE_URL: 'https://project.example', SUPABASE_SERVICE_ROLE_KEY: 'secret-test-key' },
    fetchImpl,
  });
  const payment = await store.createPendingPayment({
    userId: 'user-1', packageId: 'time-12h-kes10', amountKes: 10,
  });
  assert.equal(payment.id, 'payment-uuid');
  assert.equal(payment.amountKes, 10);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.apikey, 'secret-test-key');
  assert.equal(calls[0].url.includes('secret-test-key'), false);
});

test('requires server-side Supabase credentials', () => {
  const { createSupabaseStore } = require('./supabase-store');
  assert.throws(() => createSupabaseStore({ env: {} }), /SUPABASE_URL/);
});
