/**
 * Wave payment provider adapter.
 *
 * Implements the standard provider interface:
 *   createCheckout(opts) → { id, checkoutUrl, raw }
 *   sendPayout(opts)     → { id, status, raw }
 *   verifyWebhookSignature(rawBody, signature) → parsed event object
 *
 * Env vars required:
 *   WAVE_API_KEY           — Wave Business API key
 *   WAVE_WEBHOOK_SECRET    — Webhook signing secret
 */
const crypto = require('crypto');

const BASE_URL = 'https://api.wave.com/v1';

async function waveRequest(method, path, body, idempotencyKey) {
  const headers = {
    Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
    'Content-Type': 'application/json'
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Wave API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Create a Wave checkout session.
 * @param {object} opts
 * @param {number}  opts.amount       — Amount in XOF (will be rounded to integer)
 * @param {string}  opts.currency     — e.g. 'XOF'
 * @param {string}  opts.clientRef    — Internal reference (billing ID)
 * @param {string}  opts.successUrl   — Redirect after successful payment
 * @param {string}  opts.errorUrl     — Redirect after failed payment
 * @returns {{ id: string, checkoutUrl: string, raw: object }}
 */
async function createCheckout({ amount, currency, clientRef, successUrl, errorUrl }) {
  const data = await waveRequest('POST', '/checkout/sessions', {
    amount: String(Math.round(amount)),
    currency,
    client_reference: clientRef,
    success_url: successUrl,
    error_url: errorUrl
  });

  return {
    id: data.id,
    checkoutUrl: data.wave_launch_url,
    raw: data
  };
}

/**
 * Send a payout via Wave.
 * @param {object} opts
 * @param {string}  opts.phoneNumber    — Recipient Wave-registered phone (e.g. '+221XXXXXXXXX')
 * @param {number}  opts.amount         — Amount in XOF
 * @param {string}  opts.currency       — e.g. 'XOF'
 * @param {string}  opts.note           — Payment reason (shown to recipient)
 * @param {string}  opts.idempotencyKey — Unique key to prevent duplicate payouts
 * @returns {{ id: string, status: string, raw: object }}
 */
async function sendPayout({ phoneNumber, amount, currency, note, idempotencyKey }) {
  const data = await waveRequest(
    'POST',
    '/payout',
    {
      receive_amount: String(Math.round(amount)),
      currency,
      mobile: phoneNumber,
      payment_reason: note
    },
    idempotencyKey || `payout-${Date.now()}`
  );

  return {
    id: data.id,
    status: data.status,
    raw: data
  };
}

/**
 * Verify Wave webhook signature and return the parsed event.
 * Wave sends HMAC-SHA256 of the raw body in the 'wave-signature' header.
 * @param {Buffer|string} rawBody
 * @param {string}        signature — value of the 'wave-signature' header
 * @returns {object} parsed event
 * @throws if signature is invalid or secret is not configured
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) throw new Error('WAVE_WEBHOOK_SECRET is not configured');
  if (!signature) throw new Error('Missing wave-signature header');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    throw new Error('Invalid Wave webhook signature');
  }

  return JSON.parse(rawBody.toString());
}

module.exports = { createCheckout, sendPayout, verifyWebhookSignature };
