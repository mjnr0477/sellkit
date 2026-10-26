'use strict';

const { getPackage } = require('./packages');

/**
 * Framework-neutral checkout orchestration.
 *
 * store must provide durable, atomic operations in production:
 * createPendingPayment, findPaymentByCheckoutRequestId, markPaymentSucceeded,
 * markPaymentFailed, and createEntitlementIfAbsent.
 * Do not use an in-memory store for real customer payments.
 */
function createPurchaseService({ daraja, store, clock = () => Date.now() }) {
  if (!daraja || typeof daraja.initiateStkPush !== 'function') {
    throw new TypeError('daraja.initiateStkPush is required');
  }
  for (const method of [
    'createPendingPayment',
    'attachCheckoutRequest',
    'findPaymentByCheckoutRequestId',
    'markPaymentSucceeded',
    'markPaymentFailed',
    'createEntitlementIfAbsent',
  ]) {
    if (!store || typeof store[method] !== 'function') {
      throw new TypeError(`store.${method} is required`);
    }
  }

  async function startPurchase({ userId, packageId, phone }) {
    if (typeof userId !== 'string' || !userId.trim()) throw new TypeError('userId is required');
    const plan = getPackage(packageId);
    if (!plan) throw new RangeError('Unknown package');

    // Create a durable idempotency record before calling the external provider.
    const payment = await store.createPendingPayment({
      userId,
      packageId: plan.id,
      amountKes: plan.amountKes,
      createdAt: clock(),
      status: 'pending',
    });

    try {
      const stk = await daraja.initiateStkPush({
        phone,
        amountKes: plan.amountKes,
        accountReference: payment.reference,
        transactionDesc: 'Timed internet',
      });
      await store.attachCheckoutRequest(payment.id, stk.checkoutRequestId);
      return { paymentId: payment.id, status: 'pending', customerMessage: stk.customerMessage };
    } catch (error) {
      await store.markPaymentFailed({ paymentId: payment.id, reason: 'STK initiation failed' });
      throw error;
    }
  }

  // Call only after validating the callback against a stored request and
  // confirming transaction status with Daraja. Never trust browser redirects.
  async function confirmVerifiedPayment({ checkoutRequestId, receiptNumber, verifiedAt }) {
    if (!checkoutRequestId || !receiptNumber) throw new TypeError('Verified transaction identifiers are required');
    const payment = await store.findPaymentByCheckoutRequestId(checkoutRequestId);
    if (!payment) throw new Error('No matching pending payment');
    if (payment.status === 'succeeded') {
      const alreadyPaidPlan = getPackage(payment.packageId);
      if (!alreadyPaidPlan) throw new Error('Unknown package on paid payment');
      return store.createEntitlementIfAbsent({
        paymentId: payment.id,
        userId: payment.userId,
        packageId: payment.packageId,
        startsAt: payment.paidAt,
        durationMs: alreadyPaidPlan.durationMs,
      });
    }
    if (payment.status !== 'pending') throw new Error('Payment is not pending');
    const plan = getPackage(payment.packageId);
    if (!plan || payment.amountKes !== plan.amountKes) throw new Error('Payment amount/package mismatch');

    const paid = await store.markPaymentSucceeded({
      paymentId: payment.id,
      receiptNumber,
      paidAt: verifiedAt || clock(),
    });
    return store.createEntitlementIfAbsent({
      paymentId: paid.id,
      userId: paid.userId,
      packageId: paid.packageId,
      startsAt: paid.paidAt,
      durationMs: plan.durationMs,
    });
  }

  async function verifyAndProcessStkCallback(callbackBody) {
    if (!daraja || typeof daraja.queryStkPush !== 'function') {
      throw new Error('Daraja status-query support is required before processing callbacks');
    }
    const callback = callbackBody && callbackBody.Body && callbackBody.Body.stkCallback;
    if (!callback || typeof callback.CheckoutRequestID !== 'string') {
      throw new TypeError('Malformed Daraja STK callback');
    }
    if (String(callback.ResultCode) !== '0') {
      // A callback alone must not grant access. Reconcile failures separately
      // using Daraja's status query and stored transaction state.
      return { activated: false, status: 'awaiting_reconciliation' };
    }

    const payment = await store.findPaymentByCheckoutRequestId(callback.CheckoutRequestID);
    if (!payment) throw new Error('No matching pending payment');
    const queryResult = await daraja.queryStkPush({ checkoutRequestId: callback.CheckoutRequestID });
    if (String(queryResult.ResultCode) !== '0') {
      return { activated: false, status: 'awaiting_reconciliation' };
    }

    const items = callback.CallbackMetadata && callback.CallbackMetadata.Item;
    const metadata = Array.isArray(items)
      ? Object.fromEntries(items.filter((item) => item && typeof item.Name === 'string').map((item) => [item.Name, item.Value]))
      : {};
    const amount = Number(metadata.Amount);
    const receiptNumber = metadata.MpesaReceiptNumber;
    if (!Number.isFinite(amount) || amount !== payment.amountKes) {
      throw new Error('M-PESA callback amount does not match the stored package price');
    }
    if (typeof receiptNumber !== 'string' || !receiptNumber.trim()) {
      throw new Error('M-PESA receipt number is missing');
    }

    const entitlement = await confirmVerifiedPayment({
      checkoutRequestId: callback.CheckoutRequestID,
      receiptNumber,
      verifiedAt: clock(),
    });
    return { activated: true, status: 'succeeded', entitlement };
  }

  async function failVerifiedPayment({ checkoutRequestId, reason }) {
    const payment = await store.findPaymentByCheckoutRequestId(checkoutRequestId);
    if (!payment) throw new Error('No matching pending payment');
    if (payment.status !== 'pending') return payment;
    return store.markPaymentFailed({ paymentId: payment.id, reason: String(reason || 'Payment failed') });
  }

  return { startPurchase, confirmVerifiedPayment, verifyAndProcessStkCallback, failVerifiedPayment };
}

module.exports = { createPurchaseService };
