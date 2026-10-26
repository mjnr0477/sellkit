'use strict';

const crypto = require('node:crypto');

function createSupabaseStore({ env = process.env, fetchImpl = fetch } = {}) {
  const baseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

  async function request(table, { method = 'GET', query = '', body, prefer } = {}) {
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    const response = await fetchImpl(`${baseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { throw new Error('Supabase returned invalid JSON'); }
    }
    if (!response.ok) {
      const message = data && typeof data.message === 'string' ? data.message : `HTTP ${response.status}`;
      throw new Error(`Supabase request failed: ${message}`);
    }
    return data;
  }

  function toPayment(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      packageId: row.package_id,
      amountKes: row.amount_kes,
      reference: row.reference,
      status: row.status,
      checkoutRequestId: row.checkout_request_id,
      receiptNumber: row.receipt_number,
      paidAt: row.paid_at_ms,
    };
  }

  async function createPendingPayment(data) {
    const rows = await request('time_internet_payments', {
      method: 'POST',
      query: 'select=*',
      prefer: 'return=representation',
      body: {
        user_id: data.userId,
        package_id: data.packageId,
        amount_kes: data.amountKes,
        status: 'pending',
        reference: `ticket_${crypto.randomBytes(5).toString('hex')}`,
      },
    });
    if (!Array.isArray(rows) || !rows[0]) throw new Error('Payment record was not created');
    return toPayment(rows[0]);
  }

  async function attachCheckoutRequest(id, checkoutRequestId) {
    const rows = await request('time_internet_payments', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(id)}&select=*`,
      prefer: 'return=representation',
      body: { checkout_request_id: checkoutRequestId },
    });
    if (!Array.isArray(rows) || !rows[0]) throw new Error('Could not attach Daraja checkout request');
    return toPayment(rows[0]);
  }

  async function findPaymentByCheckoutRequestId(checkoutRequestId) {
    const query = new URLSearchParams({
      select: '*',
      checkout_request_id: `eq.${checkoutRequestId}`,
      limit: '1',
    });
    const rows = await request('time_internet_payments', { query: query.toString() });
    return Array.isArray(rows) && rows[0] ? toPayment(rows[0]) : null;
  }

  async function markPaymentSucceeded({ paymentId, receiptNumber, paidAt }) {
    const rows = await request('time_internet_payments', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(paymentId)}&status=eq.pending&select=*`,
      prefer: 'return=representation',
      body: { status: 'succeeded', receipt_number: receiptNumber, paid_at_ms: paidAt },
    });
    if (Array.isArray(rows) && rows[0]) return toPayment(rows[0]);
    const existing = await request('time_internet_payments', {
      query: `id=eq.${encodeURIComponent(paymentId)}&select=*&limit=1`,
    });
    if (Array.isArray(existing) && existing[0] && existing[0].status === 'succeeded') return toPayment(existing[0]);
    throw new Error('Payment could not transition from pending to succeeded');
  }

  async function markPaymentFailed({ paymentId, reason }) {
    const rows = await request('time_internet_payments', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(paymentId)}&status=eq.pending&select=*`,
      prefer: 'return=representation',
      body: { status: 'failed', failure_reason: String(reason).slice(0, 200) },
    });
    if (Array.isArray(rows) && rows[0]) return toPayment(rows[0]);
    const existing = await request('time_internet_payments', {
      query: `id=eq.${encodeURIComponent(paymentId)}&select=*&limit=1`,
    });
    return Array.isArray(existing) && existing[0] ? toPayment(existing[0]) : null;
  }

  async function createEntitlementIfAbsent(data) {
    const startsAt = data.startsAt;
    const durationMs = data.durationMs;
    if (!Number.isSafeInteger(startsAt) || !Number.isSafeInteger(durationMs) || durationMs <= 0) {
      throw new TypeError('Valid startsAt and durationMs are required');
    }
    const query = 'on_conflict=payment_id&select=*';
    const rows = await request('time_internet_entitlements', {
      method: 'POST',
      query,
      prefer: 'resolution=ignore-duplicates,return=representation',
      body: {
        payment_id: data.paymentId,
        user_id: data.userId,
        package_id: data.packageId,
        starts_at_ms: startsAt,
        expires_at_ms: startsAt + durationMs,
      },
    });
    if (Array.isArray(rows) && rows[0]) return toEntitlement(rows[0]);
    const existingQuery = new URLSearchParams({
      select: '*', payment_id: `eq.${data.paymentId}`, limit: '1',
    });
    const existing = await request('time_internet_entitlements', { query: existingQuery.toString() });
    if (Array.isArray(existing) && existing[0]) return toEntitlement(existing[0]);
    throw new Error('Entitlement could not be created or recovered');
  }

  function toEntitlement(row) {
    return {
      id: row.id,
      paymentId: row.payment_id,
      userId: row.user_id,
      packageId: row.package_id,
      startsAt: row.starts_at_ms,
      expiresAt: row.expires_at_ms,
      durationMs: row.expires_at_ms - row.starts_at_ms,
    };
  }

  return {
    createPendingPayment,
    attachCheckoutRequest,
    findPaymentByCheckoutRequestId,
    markPaymentSucceeded,
    markPaymentFailed,
    createEntitlementIfAbsent,
  };
}

module.exports = { createSupabaseStore };
