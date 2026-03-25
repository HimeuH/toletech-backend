/**
 * payment.js — Provider-agnostic payment gateway.
 *
 * Each provider adapter (utils/providers/<name>.js) must export:
 *   createCheckout(opts) → { id, checkoutUrl, raw }
 *   sendPayout(opts)     → { id, status, raw }
 *   verifyWebhookSignature(rawBody, signature) → parsed event object
 *
 * Supported providers: WAVE, ORANGE_MONEY
 */

const PROVIDERS = {
  WAVE: () => require('./providers/wave'),
  ORANGE_MONEY: () => require('./providers/orange_money')
};

function getProvider(name) {
  const key = (name || '').toUpperCase();
  if (!PROVIDERS[key]) throw new Error(`Unknown payment provider: "${name}". Supported: ${Object.keys(PROVIDERS).join(', ')}`);
  return PROVIDERS[key]();
}

/**
 * Create a checkout session with the given provider.
 * @param {string} provider — e.g. 'WAVE'
 * @param {object} opts     — { amount, currency, clientRef, successUrl, errorUrl }
 * @returns {{ id, checkoutUrl, raw }}
 */
async function createCheckout(provider, opts) {
  return getProvider(provider).createCheckout(opts);
}

/**
 * Send a payout to a recipient.
 * @param {string} provider — e.g. 'WAVE'
 * @param {object} opts     — { phoneNumber, amount, currency, note, idempotencyKey }
 * @returns {{ id, status, raw }}
 */
async function sendPayout(provider, opts) {
  return getProvider(provider).sendPayout(opts);
}

/**
 * Verify a webhook signature and return the parsed event.
 * @param {string}        provider  — e.g. 'WAVE'
 * @param {Buffer|string} rawBody
 * @param {string}        signature — provider-specific signature header value
 * @returns {object} parsed event
 * @throws if signature is invalid
 */
function verifyWebhook(provider, rawBody, signature) {
  return getProvider(provider).verifyWebhookSignature(rawBody, signature);
}

/**
 * Resolve commission amount for a transaction.
 *
 * Lookup priority (most specific wins):
 *   1. storageId-specific config
 *   2. partnerId-specific config
 *   3. transactionType default config
 *   4. env fallback (COMMISSION_STORAGE_PERCENT / COMMISSION_TRANSPORT_PERCENT)
 *
 * @param {'STORAGE'|'TRANSPORT'} transactionType
 * @param {object} opts — optional { partnerId, storageId }
 * @returns {{ commissionAmount: number, mode: string, value: number }}
 */
async function computeCommission(totalAmount, transactionType, opts = {}) {
  const CommissionConfig = require('../models/CommissionConfig');
  const { partnerId, storageId } = opts;
  const baseQuery = { transactionType, isActive: true };

  let config = null;

  if (storageId) {
    config = await CommissionConfig.findOne({ ...baseQuery, storageId });
  }
  if (!config && partnerId) {
    config = await CommissionConfig.findOne({ ...baseQuery, partnerId, storageId: null });
  }
  if (!config) {
    config = await CommissionConfig.findOne({ ...baseQuery, partnerId: null, storageId: null });
  }

  let mode, value;
  if (config) {
    mode = config.mode;
    value = config.value;
  } else {
    // env fallback
    const envKey = transactionType === 'STORAGE' ? 'COMMISSION_STORAGE_PERCENT' : 'COMMISSION_TRANSPORT_PERCENT';
    const defaultPct = transactionType === 'STORAGE' ? '10' : '15';
    mode = 'PERCENTAGE';
    value = parseFloat(process.env[envKey] || defaultPct);
  }

  const commissionAmount =
    mode === 'FIXED' ? value : Math.round(totalAmount * value / 100);

  return { commissionAmount, mode, value };
}

module.exports = { createCheckout, sendPayout, verifyWebhook, computeCommission };
