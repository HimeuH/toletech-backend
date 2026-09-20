const mongoose = require('mongoose');

/**
 * IdempotencyKey — B12 (redesign plan §7). A request carrying an
 * `Idempotency-Key` header that's been seen before (same key + same user)
 * gets the exact same response replayed instead of re-running the handler —
 * safe retries for the offline write queue (Phase 3, §6.3) and double-tap
 * protection on reservations/transport actions/payments.
 *
 * TTL index auto-expires entries after 48h — matches how long the front's
 * offline queue is expected to hold a request before giving up.
 */
const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  statusCode: { type: Number, required: true },
  responseBody: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 48 },
});

idempotencyKeySchema.index({ key: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);
