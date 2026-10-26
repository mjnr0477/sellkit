'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPurchaseService } = require('./purchase');

function fakeStore() {
  const payments = new Map();
  const entitlements = new Map();
  let nextId = 1;
  return {
    payments, entitlements,
    async createPendingPayment(data) {
      const payment = { ...data, id: String(nextId++), reference: `ticket_${nextId}` };
      payments.set(payment.id, payment);
      return payment;
    },
    async attachCheckoutRequest(id, checkoutRequestId) {
      const payment = payments.get(id);
      payment.checkoutRequestId = checkoutRequestId;
      return payment;
    },
    async findPaymentByCheckoutRequestId(id) {
      return [...payments.values()].find((p) => p.checkoutRequestId === id) || null;
    },
    async markPaymentSucceeded({ paymentId, receiptNumber, paidAt }) {
      const payment = payments.get(paymentId);
      Object.assign(payment, { status: 'succeeded', receiptNumber, paidAt });
      return payment;
    },
    async markPaymentFailed({ paymentId, reason }) {
      const payment = payments.get(paymentId);
      Object.assign(payment, { status: 'failed', reason });
      return payment;
    },
    async createEntitlementIfAbsent(data) {
      if (!entitlements.has(data.paymentId)) entitlements.set(data.paymentId, data);
      return entitlements.get(data.paymentId);
    },
  };
}

test('purchase requests STK for a known package and activates only after verified confirmation', async () => {
  const store = fakeStore();
  const calls = [];
  const service = createPurchaseService({
    store,
    clock: () => 1000,
    daraja: { async initiateStkPush(args) {
      calls.push(args);
      return { checkoutRequestId: 'checkout-123', customerMessage: 'Check phone' };
    } },
  });

  const purchase = await service.startPurchase({
    userId: 'user-1', packageId: 'time-12h-kes10', phone: '0712345678',
  });
  assert.equal(purchase.status, 'pending');
  assert.equal(calls[0].amountKes, 10);
  assert.equal(store.entitlements.size, 0);

  const entitlement = await service.confirmVerifiedPayment({
    checkoutRequestId: 'checkout-123', receiptNumber: 'ABC123', verifiedAt: 2000,
  });
  assert.equal(entitlement.userId, 'user-1');
  assert.equal(entitlement.startsAt, 2000);
  assert.equal(entitlement.durationMs, 12 * 60 * 60 * 1000);
  assert.equal(store.entitlements.size, 1);
});

test('repeated verified callback does not create a second entitlement', async () => {
  const store = fakeStore();
  const service = createPurchaseService({
    store,
    clock: () => 1000,
    daraja: { async initiateStkPush() { return { checkoutRequestId: 'checkout-456' }; } },
  });
  await service.startPurchase({ userId: 'user-2', packageId: 'time-12h-kes10', phone: '0712345678' });
  const first = await service.confirmVerifiedPayment({ checkoutRequestId: 'checkout-456', receiptNumber: 'XYZ', verifiedAt: 2000 });
  const second = await service.confirmVerifiedPayment({ checkoutRequestId: 'checkout-456', receiptNumber: 'XYZ', verifiedAt: 3000 });
  assert.deepEqual(second, first);
  assert.equal(store.entitlements.size, 1);
});

test('malformed Daraja response is not stored as a usable checkout request', async () => {
  const store = fakeStore();
  const service = createPurchaseService({
    store,
    daraja: { async initiateStkPush() { return { customerMessage: 'Check phone' }; } },
  });
  await assert.rejects(
    service.startPurchase({ userId: 'user-malformed', packageId: 'time-12h-kes10', phone: '0712345678' }),
    /no usable checkout request ID/,
  );
  assert.equal(store.payments.size, 1);
  assert.equal([...store.payments.values()][0].status, 'pending');
  assert.equal([...store.payments.values()][0].checkoutRequestId, undefined);
});

test('unknown package is rejected before payment provider is called', async () => {
  const store = fakeStore();
  let called = false;
  const service = createPurchaseService({
    store,
    daraja: { async initiateStkPush() { called = true; return {}; } },
  });
  await assert.rejects(service.startPurchase({ userId: 'user-3', packageId: 'unknown', phone: '0712345678' }), /Unknown package/);
  assert.equal(called, false);
});

test('successful callback requires Daraja status verification and matching amount', async () => {
  const store = fakeStore();
  let queried = 0;
  const service = createPurchaseService({
    store,
    clock: () => 5000,
    daraja: {
      async initiateStkPush() { return { checkoutRequestId: 'checkout-verified' }; },
      async queryStkPush() { queried += 1; return { ResultCode: '0' }; },
    },
  });
  await service.startPurchase({ userId: 'user-4', packageId: 'time-12h-kes10', phone: '0712345678' });
  const result = await service.verifyAndProcessStkCallback({
    Body: { stkCallback: {
      CheckoutRequestID: 'checkout-verified',
      ResultCode: 0,
      CallbackMetadata: { Item: [
        { Name: 'Amount', Value: 10 },
        { Name: 'MpesaReceiptNumber', Value: 'RCP123' },
      ] },
    } },
  });
  assert.equal(queried, 1);
  assert.equal(result.activated, true);
  assert.equal(result.entitlement.durationMs, 12 * 60 * 60 * 1000);
});

test('does not activate when Daraja cannot confirm the transaction', async () => {
  const store = fakeStore();
  const service = createPurchaseService({
    store,
    clock: () => 5000,
    daraja: {
      async initiateStkPush() { return { checkoutRequestId: 'checkout-pending' }; },
      async queryStkPush() { return { ResultCode: '1032' }; },
    },
  });
  await service.startPurchase({ userId: 'user-5', packageId: 'time-12h-kes10', phone: '0712345678' });
  const result = await service.verifyAndProcessStkCallback({
    Body: { stkCallback: {
      CheckoutRequestID: 'checkout-pending',
      ResultCode: 0,
      CallbackMetadata: { Item: [
        { Name: 'Amount', Value: 10 },
        { Name: 'MpesaReceiptNumber', Value: 'FAKE123' },
      ] },
    } },
  });
  assert.equal(result.activated, false);
  assert.equal(store.entitlements.size, 0);
});
