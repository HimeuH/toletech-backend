/**
 * PI-SPI payment provider adapter.
 *
 * QR Code is FORBIDDEN for online/remote payments (PI-SPI policy).
 * ToleTech is an online platform — RTP is the only permitted payment method.
 *
 * Implements the standard provider interface:
 *   createRtp(opts)      → { id, checkoutUrl: null, raw }
 *   sendPayout(opts)     → { id, status, raw }
 *   verifyWebhookSignature(rawBody, signature) → parsed event object
 *
 * Env vars required:
 *   PISPI_CLIENT_ID        — OAuth2 client ID
 *   PISPI_CLIENT_SECRET    — OAuth2 client secret
 *   PISPI_API_KEY          — x-api-key header
 *   PISPI_TOKEN_URL        — Cognito token endpoint (plain HTTPS)
 *   PISPI_BASE_URL         — PI-SPI API base URL (mTLS)
 *   PISPI_WEBHOOK_SECRET   — HMAC-SHA256 signing secret
 *   PISPI_CERT_PATH        — Path to client .crt PEM file
 *   PISPI_KEY_PATH         — Path to client .key PEM file
 *   PISPI_CA_PATH          — Path to BCEAO CA bundle .crt
 *   PISPI_ENABLED          — 'true' to enable, anything else = disabled
 *
 * Node 18 native fetch does NOT support custom TLS agents.
 * All PI-SPI API calls (not the token endpoint) use https.request() with
 * a custom https.Agent carrying the client cert — no extra dependencies needed.
 */

const https   = require('https');
const fs      = require('fs');
const crypto  = require('crypto');
const { URL } = require('url');
const { getToken, invalidate } = require('../pispiToken');

// ---------------------------------------------------------------------------
// mTLS agent (lazy-initialised — certs only read on first API call)
// ---------------------------------------------------------------------------
let _agent = null;

function getMtlsAgent() {
  if (_agent) return _agent;

  // PISPI_MTLS_SKIP=true — sandbox only, when PICERT certs are unavailable.
  // NEVER set this in production.
  if (process.env.PISPI_MTLS_SKIP === 'true') {
    if (process.env.NODE_ENV === 'PRODUCTION') {
      throw new Error('PISPI_MTLS_SKIP cannot be used in production');
    }
    console.warn('[PISPI] WARNING: mTLS disabled (PISPI_MTLS_SKIP=true) — sandbox only');
    _agent = new https.Agent({ keepAlive: true, timeout: 15000 });
    return _agent;
  }

  const certPath = process.env.PISPI_CERT_PATH;
  const keyPath  = process.env.PISPI_KEY_PATH;
  const caPath   = process.env.PISPI_CA_PATH;

  if (!certPath || !keyPath || !caPath) {
    throw new Error('PISPI mTLS env vars not configured (PISPI_CERT_PATH / KEY_PATH / CA_PATH)');
  }

  _agent = new https.Agent({
    cert:               fs.readFileSync(certPath),
    key:                fs.readFileSync(keyPath),
    ca:                 fs.readFileSync(caPath),
    rejectUnauthorized: true, // NEVER false — BCEAO CA must be trusted explicitly
    keepAlive:          true,
    timeout:            15000,
  });

  return _agent;
}

// ---------------------------------------------------------------------------
// Internal HTTP helper — wraps https.request as a Promise
// Used for all calls to sandbox.api.pi-bceao.com (mTLS required)
// ---------------------------------------------------------------------------
function pispiRequest(method, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const base    = process.env.PISPI_BASE_URL;
    const parsed  = new URL(`${base}${path}`);
    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname + parsed.search,
      method,
      agent:    getMtlsAgent(),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    process.env.PISPI_API_KEY,
        ...extraHeaders,
      },
    };

    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch { data = { raw }; }

        if (res.statusCode >= 400) {
          const err = new Error(`PISPI API error ${res.statusCode}: ${JSON.stringify(data)}`);
          err.statusCode = res.statusCode;
          err.data = data;
          return reject(err);
        }
        resolve(data);
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('PISPI request timeout')); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Authenticated request helper (injects Bearer token + handles 401 retry once)
// ---------------------------------------------------------------------------
async function pispiAuthRequest(method, path, body, extraHeaders = {}) {
  const token = await getToken();
  try {
    return await pispiRequest(method, path, body, {
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    });
  } catch (err) {
    if (err.statusCode === 401) {
      // Token may have expired — invalidate cache and retry once
      invalidate();
      const freshToken = await getToken();
      return pispiRequest(method, path, body, {
        Authorization: `Bearer ${freshToken}`,
        ...extraHeaders,
      });
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// createRtp — Request to Pay (only permitted online payment method per PI-SPI policy)
//
// @param {object} opts
// @param {number}  opts.amount
// @param {string}  opts.currency
// @param {string}  opts.debtorAlias     — Farmer's alias (phone or SHID)
// @param {string}  opts.idempotencyKey
// @param {string}  [opts.description]
// @returns {{ id: string, checkoutUrl: null, raw: object }}
// ---------------------------------------------------------------------------
async function createRtp({ amount, currency, debtorAlias, idempotencyKey, description }) {
  if (process.env.PISPI_ENABLED !== 'true') {
    throw new Error('PISPI provider is disabled (PISPI_ENABLED != "true")');
  }

  const data = await pispiAuthRequest(
    'POST',
    '/rtp',
    {
      amount:      Math.round(amount),
      currency:    currency || 'XOF',
      debtorAlias,
      reference:   idempotencyKey,
      description: description || `Paiement ToleTech`,
    },
    { 'X-Idempotency-Key': idempotencyKey }
  );

  return {
    id:          data.rtpId,
    checkoutUrl: null,
    raw:         data,
  };
}

// ---------------------------------------------------------------------------
// sendPayout — disburse funds to a recipient
//
// @param {object} opts
// @param {string}  opts.recipientAlias  — Recipient's PI-SPI alias
// @param {number}  opts.amount
// @param {string}  opts.currency
// @param {string}  opts.note
// @param {string}  opts.idempotencyKey
// @returns {{ id: string, status: string, raw: object }}
// ---------------------------------------------------------------------------
async function sendPayout({ recipientAlias, amount, currency, note, idempotencyKey }) {
  if (process.env.PISPI_ENABLED !== 'true') {
    throw new Error('PISPI provider is disabled (PISPI_ENABLED != "true")');
  }

  const data = await pispiAuthRequest(
    'POST',
    '/payouts',
    {
      amount:         Math.round(amount),
      currency:       currency || 'XOF',
      creditorAlias:  recipientAlias,
      description:    note,
      reference:      idempotencyKey,
    },
    { 'X-Idempotency-Key': idempotencyKey }
  );

  return {
    id:     data.payoutId || data.id,
    status: data.status,
    raw:    data,
  };
}

// ---------------------------------------------------------------------------
// verifyWebhookSignature — HMAC-SHA256 verification
//
// PI-SPI sends the signature in the 'x-pispi-signature' header.
// MUST use crypto.timingSafeEqual — never === (timing attack).
//
// @param {Buffer|string} rawBody
// @param {string}        signatureHeader — value of x-pispi-signature
// @returns {object} parsed event
// @throws if signature is invalid or secret not configured
// ---------------------------------------------------------------------------
function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.PISPI_WEBHOOK_SECRET;
  if (!secret) throw new Error('PISPI_WEBHOOK_SECRET is not configured');
  if (!signatureHeader) throw new Error('Missing x-pispi-signature header');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);

  // timingSafeEqual requires equal-length buffers
  const valid =
    sigBuf.length === expBuf.length &&
    crypto.timingSafeEqual(sigBuf, expBuf);

  if (!valid) throw new Error('Invalid PISPI webhook signature');

  return JSON.parse(rawBody.toString());
}

module.exports = { createRtp, sendPayout, verifyWebhookSignature };
