'use strict';

const crypto = require('node:crypto');

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(input, secret) {
  return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

function createAccessToken(entitlement, secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('TIME_INTERNET_TOKEN_SECRET must be at least 32 characters');
  }
  if (!entitlement || !entitlement.id || !entitlement.userId ||
      !Number.isSafeInteger(entitlement.startsAt) || !Number.isSafeInteger(entitlement.expiresAt) ||
      entitlement.expiresAt <= entitlement.startsAt) {
    throw new TypeError('A valid persisted entitlement is required');
  }
  const header = encode({ alg: 'HS256', typ: 'TIT' });
  const payload = encode({
    sub: entitlement.userId,
    entitlementId: entitlement.id,
    paymentId: entitlement.paymentId,
    packageId: entitlement.packageId,
    iat: entitlement.startsAt,
    exp: entitlement.expiresAt,
  });
  const input = `${header}.${payload}`;
  return `${input}.${signature(input, secret)}`;
}

function verifyAccessToken(token, secret, trustedNow = Date.now()) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Token secret is not configured securely');
  if (typeof token !== 'string' || !Number.isSafeInteger(trustedNow)) {
    return { allowed: false, reason: 'invalid_request' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) return { allowed: false, reason: 'malformed_token' };
  const input = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(signature(input, secret));
  const received = Buffer.from(parts[2]);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return { allowed: false, reason: 'invalid_signature' };
  }
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { allowed: false, reason: 'malformed_token' };
  }
  if (!header || header.alg !== 'HS256' || header.typ !== 'TIT' ||
      typeof claims.sub !== 'string' || typeof claims.entitlementId !== 'string' ||
      !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
      claims.exp <= claims.iat) {
    return { allowed: false, reason: 'invalid_claims' };
  }
  if (trustedNow < claims.iat) return { allowed: false, reason: 'not_yet_active' };
  if (trustedNow >= claims.exp) return { allowed: false, reason: 'expired' };
  return { allowed: true, subject: claims.sub, entitlementId: claims.entitlementId, expiresAt: claims.exp };
}

module.exports = { createAccessToken, verifyAccessToken };
