/**
 * Orange Money (Sonatel eWallet API, Senegal) payment provider adapter.
 *
 * Implements the standard provider interface:
 *   createCheckout(opts) → { id, checkoutUrl, raw }
 *   sendPayout(opts)     → { id, status, raw }
 *   verifyWebhookSignature(rawBody, signature) → parsed event object
 *
 * Checkout uses the QR code / deep link flow (POST /api/eWallet/v4/qrcode) — there is
 * no redirect-style checkout on this API. Payout uses cash in (POST /api/eWallet/v1/cashins),
 * which credits the recipient's wallet from ToleTech's retailer/partner wallet and requires
 * the partner's PIN, RSA-encrypted with the API's public key on every call.
 *
 * Env vars required:
 *   ORANGE_MONEY_CLIENT_ID       — OAuth2 client_id
 *   ORANGE_MONEY_CLIENT_SECRET   — OAuth2 client_secret
 *   ORANGE_MONEY_BASE_URL        — API base (default: https://api.sandbox.orange-sonatel.com)
 *   ORANGE_MONEY_MERCHANT_CODE   — 6-digit merchant code used for QR checkout
 *   ORANGE_MONEY_MERCHANT_NAME   — Merchant display name shown to the payer
 *   ORANGE_MONEY_PARTNER_MSISDN  — Retailer/partner account MSISDN used for payouts (cash in)
 *   ORANGE_MONEY_PARTNER_PIN     — Retailer/partner PIN, RSA-encrypted per call (never sent in clear)
 *   ORANGE_MONEY_WEBHOOK_SECRET  — Partner endpoint secret, HMAC-SHA256 key for X-Sonatel-Signature
 */
const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://api.sandbox.orange-sonatel.com';
const QR_VALIDITY_SECONDS = 900;

// In-memory token cache — one token per process lifetime, refreshed before expiry
const tokenCache = { token: null, expiresAt: 0 };
// In-memory public key cache — refetched on demand (e.g. after a 4003 "revoked key" error)
const publicKeyCache = { key: null, keyId: null };

function baseUrl() {
  return process.env.ORANGE_MONEY_BASE_URL || DEFAULT_BASE_URL;
}

/**
 * Fetch (or return cached) OAuth2 access token.
 * Token is refreshed 10 seconds before expiry to avoid race conditions.
 */
async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 10_000) {
    return tokenCache.token;
  }

  const clientId = process.env.ORANGE_MONEY_CLIENT_ID;
  const clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('ORANGE_MONEY_CLIENT_ID and ORANGE_MONEY_CLIENT_SECRET are not configured');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const res = await fetch(`${baseUrl()}/oauth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
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

async function omRequest(method, path, body, extraHeaders = {}) {
  const token = await getAccessToken();

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extraHeaders
  };

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`Orange Money API error ${res.status}: ${JSON.stringify(data)}`);
    err.statusCode = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

/**
 * Fetch (or return cached) RSA public key used to encrypt sensitive fields (PIN codes).
 */
async function getPublicKey() {
  if (publicKeyCache.key) return publicKeyCache;

  const data = await omRequest('GET', '/api/account/v1/publicKeys');
  publicKeyCache.key = data.key;
  publicKeyCache.keyId = data.keyId;
  return publicKeyCache;
}

/**
 * RSA-encrypt a PIN code with the API's public key and Base64-encode the result.
 * Automatically refetches the public key and retries once if it has been revoked (code 4003).
 * @param {string} pin
 * @returns {Promise<string>} Base64-encoded, RSA-encrypted PIN (344 chars for a 2048-bit key)
 */
async function encryptPin(pin) {
  const encryptWith = ({ key }) => {
    const pem = `-----BEGIN PUBLIC KEY-----\n${key.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
    return crypto
      .publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(pin, 'utf8'))
      .toString('base64');
  };

  const publicKey = await getPublicKey();
  try {
    return encryptWith(publicKey);
  } catch (err) {
    // Key may have been revoked server-side — force a refetch and retry once
    publicKeyCache.key = null;
    const freshKey = await getPublicKey();
    return encryptWith(freshKey);
  }
}

/**
 * Strip a leading '+221' or '221' country code, leaving the local 9-digit MSISDN
 * the Orange Money API expects (pattern ^\d{9}$).
 * @param {string} phone
 * @returns {string}
 */
function normalizeMsisdn(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  const local = digits.startsWith('221') ? digits.slice(3) : digits;
  if (!/^\d{9}$/.test(local)) {
    throw new Error(`Invalid Senegal MSISDN for Orange Money: "${phone}"`);
  }
  return local;
}

/**
 * Create an Orange Money QR code checkout — the only online-payment mechanism this API offers.
 * The customer scans the QR (or opens the deep link) in the Max It / Orange Money app to pay;
 * the outcome arrives later on the webhook, not synchronously.
 * @param {object} opts
 * @param {number}  opts.amount       — Amount in XOF (rounded to integer)
 * @param {string}  opts.currency     — e.g. 'XOF'
 * @param {string}  opts.clientRef    — Internal reference (billing ID) — echoed back on the webhook
 * @param {string}  opts.successUrl   — Shown to the payer after a successful payment
 * @param {string}  opts.errorUrl     — Shown to the payer after a cancelled payment
 * @returns {{ id: string, checkoutUrl: string, raw: object }}
 */
async function createCheckout({ amount, currency, clientRef, successUrl, errorUrl }) {
  const merchantCode = process.env.ORANGE_MONEY_MERCHANT_CODE;
  if (!merchantCode) throw new Error('ORANGE_MONEY_MERCHANT_CODE is not configured');

  const backendBase = process.env.BACKEND_URL || '';

  const data = await omRequest(
    'POST',
    '/api/eWallet/v4/qrcode',
    {
      code: merchantCode,
      name: process.env.ORANGE_MONEY_MERCHANT_NAME || 'ToleTech',
      amount: { value: Math.round(amount), unit: currency || 'XOF' },
      validity: QR_VALIDITY_SECONDS,
      reference: clientRef,
      callbackSuccessUrl: successUrl,
      callbackCancelUrl: errorUrl,
      restrictions: { isSingleUse: true }
    },
    backendBase ? { 'X-Callback-Url': `${backendBase}/api/v1/payments/webhook/orange_money` } : {}
  );

  return {
    id: data.qrId,
    checkoutUrl: data.shortLink || data.deepLink,
    raw: data
  };
}

/**
 * Send a payout via cash in — credits the recipient's Orange Money wallet from
 * ToleTech's retailer/partner wallet.
 * @param {object} opts
 * @param {string}  opts.phoneNumber    — Recipient phone (accepts '+221XXXXXXXXX', '221XXXXXXXXX' or 'XXXXXXXXX')
 * @param {number}  opts.amount         — Amount in XOF
 * @param {string}  opts.currency       — e.g. 'XOF'
 * @param {string}  opts.idempotencyKey — Used as the transaction reference
 * @returns {{ id: string, status: string, raw: object }}
 */
async function sendPayout({ phoneNumber, amount, currency, idempotencyKey }) {
  const partnerMsisdn = process.env.ORANGE_MONEY_PARTNER_MSISDN;
  const partnerPin = process.env.ORANGE_MONEY_PARTNER_PIN;
  if (!partnerMsisdn || !partnerPin) {
    throw new Error('ORANGE_MONEY_PARTNER_MSISDN and ORANGE_MONEY_PARTNER_PIN are not configured');
  }

  const encryptedPinCode = await encryptPin(partnerPin);

  const data = await omRequest('POST', '/api/eWallet/v1/cashins', {
    partner: { idType: 'MSISDN', id: partnerMsisdn, encryptedPinCode },
    customer: { idType: 'MSISDN', id: normalizeMsisdn(phoneNumber) },
    amount: { value: Math.round(amount), unit: currency || 'XOF' },
    reference: idempotencyKey,
    receiveNotification: true
  });

  return {
    id: data.transactionId,
    status: data.status,
    raw: data
  };
}

/**
 * Verify an Orange Money webhook signature and return the parsed event.
 * Header format: 'X-Sonatel-Signature: t=<unix ts>,v1=<hex hmac>[,v1=<hex hmac>...]'
 * signed_payload = "{t},{raw_body}", HMAC-SHA256 keyed with the partner endpoint secret.
 * Several v1 entries may be present during a secret rotation — any match is accepted.
 * @param {Buffer|string} rawBody
 * @param {string}        signatureHeader — value of the 'X-Sonatel-Signature' header
 * @returns {object} parsed event
 * @throws if signature is invalid, stale, or the secret is not configured
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  if (!secret) throw new Error('ORANGE_MONEY_WEBHOOK_SECRET is not configured');
  if (!signatureHeader) throw new Error('Missing X-Sonatel-Signature header');

  let timestamp = null;
  const signatures = [];
  for (const part of signatureHeader.split(',')) {
    const i = part.indexOf('=');
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') timestamp = v;
    else if (k === 'v1') signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error('Malformed X-Sonatel-Signature header');
  }

  // Reject replays older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error('Orange Money webhook timestamp too old');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp},`)
    .update(rawBody)
    .digest('hex');

  const valid = signatures.some(sig => {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });

  if (!valid) throw new Error('Invalid Orange Money webhook signature');

  return JSON.parse(rawBody.toString());
}

module.exports = { createCheckout, sendPayout, verifyWebhookSignature, normalizeMsisdn };
