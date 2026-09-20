const IdempotencyKey = require('../models/IdempotencyKey');

/**
 * idempotency — B12 (redesign plan §7). Opt-in: a request with no
 * `Idempotency-Key` header behaves exactly as before, so this is safe to
 * drop onto existing routes without any client changes. When the header is
 * present:
 *   - a first-time key runs the handler normally, then caches the response
 *     (2xx only — an error isn't "the" answer to retry-with-same-key)
 *   - a repeated key (same user + same key) replays the cached response
 *     instead of re-running the handler, so a retried reservation/payment/
 *     transport action can't double-fire.
 *
 * Requires isAuthenticatedUser to run first (needs req.user.id).
 */
module.exports = async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];
  if (!key || !req.user?.id) return next();

  try {
    const existing = await IdempotencyKey.findOne({ key, user: req.user.id });
    if (existing) {
      return res.status(existing.statusCode).json(existing.responseBody);
    }
  } catch (err) {
    // Lookup failure shouldn't block the request — worst case, no replay protection this time.
    console.error('[idempotency] lookup error:', err.message);
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = body => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      IdempotencyKey.create({
        key,
        user: req.user.id,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        responseBody: body,
      }).catch(err => {
        // A duplicate-key race (two concurrent requests with the same key) is
        // expected and harmless — the first write wins, this one just no-ops.
        if (err.code !== 11000) console.error('[idempotency] store error:', err.message);
      });
    }
    return originalJson(body);
  };

  next();
};
