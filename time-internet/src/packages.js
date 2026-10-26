'use strict';

// Prices and durations are product hypotheses for testing, not a claim that
// these prices can fund unlimited traffic. Do not publish for sale until supply
// costs, authorization, and delivery have been proven.
const PACKAGES = Object.freeze([
  Object.freeze({ id: 'time-12h-kes10', label: '12 hours', amountKes: 10, durationMs: 12 * 60 * 60 * 1000 }),
  Object.freeze({ id: 'time-24h-kes20', label: '24 hours', amountKes: 20, durationMs: 24 * 60 * 60 * 1000 }),
]);

function getPackage(id) {
  return PACKAGES.find((item) => item.id === id) || null;
}

module.exports = { PACKAGES, getPackage };
