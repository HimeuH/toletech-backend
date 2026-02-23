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
        'GENERAL'
      ],
      required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: mongoose.Schema.Types.Mixed,
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
