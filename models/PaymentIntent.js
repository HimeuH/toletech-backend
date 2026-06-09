/**
 * PaymentIntent — tracks the lifecycle of a PI-SPI RTP payment request.
 *
 * One PaymentIntent per checkout attempt. idempotencyKey is globally unique
 * so a network retry never creates a duplicate RTP at the PI-SPI API.
 *
 * The atomic status transition PENDING → CONFIRMED (inside a MongoDB transaction)
 * is the distributed lock that prevents double-credit on webhook retry.
 *
 * Note: QR Code is forbidden for online payments per PI-SPI policy — RTP only.
 */

const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const paymentIntentSchema = new Schema(
  {
    billingId:      { type: Types.ObjectId, ref: 'Billing', required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    pispiRtpId:     { type: String, default: null, index: true, sparse: true },
    amount:         { type: Number, required: true },
    currency:       { type: String, default: 'XOF' },
    status: {
      type:    String,
      enum:    ['INITIATED', 'PENDING', 'CONFIRMED', 'FAILED', 'TIMEOUT', 'EXPIRED'],
      default: 'INITIATED',
    },
    confirmedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
