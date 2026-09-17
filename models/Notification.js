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
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
