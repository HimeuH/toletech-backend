/**
 * pispiToken.js — OAuth2 client_credentials token cache for PI-SPI.
 *
 * Token endpoint is AWS Cognito — plain HTTPS, NOT mTLS.
 * Caches the token with a 30-second safety buffer before expiry.
 */

let _cache = null; // { token, expiresAt }

async function getToken() {
  if (_cache && _cache.expiresAt > Date.now() + 30_000) return _cache.token;

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     process.env.PISPI_CLIENT_ID,
    client_secret: process.env.PISPI_CLIENT_SECRET,
  });

  // Plain HTTPS fetch — Cognito does not require mTLS
  const res = await fetch(process.env.PISPI_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`PISPI token error: ${JSON.stringify(data)}`);
  if (!data.access_token) throw new Error('PISPI token response missing access_token');

  _cache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return _cache.token;
}

/** Force-clear the cache (e.g. after a 401 from the API). */
function invalidate() {
  _cache = null;
}

module.exports = { getToken, invalidate };
