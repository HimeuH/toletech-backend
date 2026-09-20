const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'RESERVATION_REQUESTED',
        'RESERVATION_APPROVED',
        'RESERVATION_REJECTED',
        'RESERVATION_CANCELLED',
        'RESERVATION_CONFIRMED',
        'PAYMENT_DUE',
        'TRANSPORT_ASSIGNED',
        'TRANSPORT_ACCEPTED',
        // A7/B2 fix: these were passed by controllers but missing from the enum,
        // so Notification.create() threw a ValidationError caught silently by the
        // callers' .catch() — the notification (and its SMS) was never sent.
        'TRANSPORT_REJECTED',
        'TRANSPORT_DELIVERED',
        'TRANSPORT_PAYMENT_RECEIVED',
        'PAYMENT_RECEIVED',
        'PAYMENT_CONFIRMED',
        // B4/B5 (redesign plan §6.5) — not yet raised by any controller, added
        // now so the enum doesn't need another migration when Phase 3-5 wire
        // disputes/payouts/expiry alerts through utils/notify.js.
        'DISPUTE_OPENED',
        'DISPUTE_RESOLVED',
        'PAYOUT_SENT',
        'TRANSPORT_EXPIRING',
        'CAPACITY_LOW',
        'GENERAL'
      ],
      required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: mongoose.Schema.Types.Mixed,
    // B2 — deep link into the front end (e.g. /reservations/:id/detail).
    // Computed server-side in utils/notify.js from (type, data) so every
    // notification, past and future, can be tapped straight to its screen.
    link: { type: String, default: null },
    // B4/B5 — derived from `type` in utils/notificationMeta.js, not passed by
    // callers: drives the front's per-category notification preferences and
    // the fallback job's "is this critical" check.
    category: {
      type: String,
      enum: ['reservations', 'transport', 'paiements', 'compte'],
      default: 'compte',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: 'normal',
    },
    // Set once utils/sendPush.js successfully delivers to at least one subscription.
    pushSentAt: { type: Date, default: null },
    // B5 push-first SMS fallback: when push succeeds for a non-critical type,
    // the SMS is deferred to this time instead of sent immediately; cleared by
    // notificationFallbackJob.js once it fires (or once read, since the job's
    // query only picks up still-unread notifications).
    smsScheduledAt: { type: Date, default: null },
    smsSentAt: { type: Date, default: null },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
// B5 — notificationFallbackJob.js polls for due, still-unread, not-yet-sent SMS.
notificationSchema.index({ smsScheduledAt: 1, smsSentAt: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
