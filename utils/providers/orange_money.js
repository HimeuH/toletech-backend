/**
 * Orange Money Marchands (Senegal) payment provider adapter.
 *
 * Implements the standard provider interface:
 *   createCheckout(opts) → { id, checkoutUrl, raw }
 *   sendPayout(opts)     → { id, status, raw }
 *   verifyWebhookSignature(rawBody, signature) → parsed event object
 *
 * Env vars required:
 *   ORANGE_MONEY_API_KEY        — OAuth2 client_id
 *   ORANGE_MONEY_API_SECRET     — OAuth2 client_secret
 *   ORANGE_MONEY_WEBHOOK_SECRET — Webhook signing secret
 *   ORANGE_MONEY_BASE_URL       — API base (default: https://api.orange.com/orange-money-webpay/sn/v1)
 */
const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://api.orange.com/orange-money-webpay/sn/v1';

// In-memory token cache — one token per process lifetime, refreshed before expiry
const tokenCache = { token: null, expiresAt: 0 };

/**
 * Fetch (or return cached) OAuth2 access token.
 * Token is refreshed 10 seconds before expiry to avoid race conditions.
 */
async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 10_000) {
    return tokenCache.token;
  }

  const clientId = process.env.ORANGE_MONEY_API_KEY;
  const clientSecret = process.env.ORANGE_MONEY_API_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('ORANGE_MONEY_API_KEY and ORANGE_MONEY_API_SECRET are not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseUrl = process.env.ORANGE_MONEY_BASE_URL || DEFAULT_BASE_URL;

  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Orange Money OAuth error ${res.status}: ${JSON.stringify(data)}`);
  }

  tokenCache.token = data.access_token;
  // expires_in is in seconds; fallback to 55s if not provided
  tokenCache.expiresAt = Date.now() + (data.expires_in ?? 55) * 1000;

  return tokenCache.token;
}

async function omRequest(method, path, body, idempotencyKey) {
  const token = await getAccessToken();
  const baseUrl = process.env.ORANGE_MONEY_BASE_URL || DEFAULT_BASE_URL;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Orange Money API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Create an Orange Money checkout session.
 * @param {object} opts
 * @param {number}  opts.amount       — Amount in XOF (rounded to integer)
 * @param {string}  opts.currency     — e.g. 'XOF'
 * @param {string}  opts.clientRef    — Internal reference (billing ID)
 * @param {string}  opts.successUrl   — Redirect after successful payment
 * @param {string}  opts.errorUrl     — Redirect after failed payment
 * @returns {{ id: string, checkoutUrl: string, raw: object }}
 */
async function createCheckout({ amount, currency, clientRef, successUrl, errorUrl }) {
  const data = await omRequest('POST', '/payments', {
    merchant_key: process.env.ORANGE_MONEY_API_KEY,
    currency,
    order_id: clientRef,
    amount: Math.round(amount),
    return_url: successUrl,
    cancel_url: errorUrl,
    notif_url: `${process.env.BACKEND_URL || ''}/api/v1/payments/webhook/orange_money`
  });

  return {
    id: data.pay_token || data.id,
    checkoutUrl: data.payment_url,
    raw: data
  };
}

/**
 * Send a B2C payout via Orange Money.
 * @param {object} opts
 * @param {string}  opts.phoneNumber    — Recipient phone (e.g. '+221XXXXXXXXX')
 * @param {number}  opts.amount         — Amount in XOF
 * @param {string}  opts.currency       — e.g. 'XOF'
 * @param {string}  opts.note           — Payment reason
 * @param {string}  opts.idempotencyKey — Unique key to prevent duplicate payouts
 * @returns {{ id: string, status: string, raw: object }}
 */
async function sendPayout({ phoneNumber, amount, currency, note, idempotencyKey }) {
  const data = await omRequest(
    'POST',
    '/b2c/payment',
    {
      merchant_key: process.env.ORANGE_MONEY_API_KEY,
      currency,
      subscriber_msisdn: phoneNumber,
      amount: Math.round(amount),
      payment_description: note
    },
    idempotencyKey || `payout-om-${Date.now()}`
  );

  return {
    id: data.id || data.pay_token,
    status: data.status,
    raw: data
  };
}

/**
 * Verify Orange Money webhook signature and return the parsed event.
 * Orange sends HMAC-SHA256 of the raw body in the 'x-orange-signature' header.
 * @param {Buffer|string} rawBody
 * @param {string}        signature — value of the 'x-orange-signature' header
 * @returns {object} parsed event
 * @throws if signature is invalid or secret is not configured
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  if (!secret) throw new Error('ORANGE_MONEY_WEBHOOK_SECRET is not configured');
  if (!signature) throw new Error('Missing x-orange-signature header');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    throw new Error('Invalid Orange Money webhook signature');
  }

  return JSON.parse(rawBody.toString());
}

module.exports = { createCheckout, sendPayout, verifyWebhookSignature };
