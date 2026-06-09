/**
 * WebhookEvent — idempotency log for incoming webhook deliveries.
 *
 * The unique index on eventId means a duplicate POST from PI-SPI
 * (or any provider) throws a duplicate-key error (code 11000), which
 * the handler catches and silently acknowledges with HTTP 200.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const webhookEventSchema = new Schema(
  {
    eventId:     { type: String, required: true, unique: true },
    source:      { type: String, default: 'PISPI' },
    type:        { type: String },
    payload:     { type: Schema.Types.Mixed },
    processed:   { type: Boolean, default: false },
    processedAt: { type: Date,    default: null },
    error:       { type: String,  default: null },
  },
  {
    timestamps: { createdAt: 'receivedAt', updatedAt: false },
  }
);

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
