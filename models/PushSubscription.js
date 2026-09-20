const mongoose = require('mongoose');

/**
 * PushSubscription — one document per browser/device subscribed to Web Push
 * (redesign plan §6.5, B4). A user can have several (phone + desktop, or a
 * reinstalled PWA), so `endpoint` — not `user` — is the unique key.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: null },
    platform: { type: String, default: null },
    lastSuccessAt: { type: Date, default: null },
    // Incremented on each failed send that isn't a 404/410 (dead subscription,
    // deleted outright instead — see utils/sendPush.js). A few transient
    // failures in a row is a signal worth surfacing later, not yet acted on.
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
