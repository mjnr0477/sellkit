'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDarajaClient, normalizePhone } = require('./daraja');

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
