const mongoose = require('mongoose');

/**
 * PaymentProviderConfig — one document per payment provider.
 * Seeded automatically on first GET /payments/providers.
 * Admin can toggle isEnabled via PUT /payments/providers/:provider.
 */
const paymentProviderConfigSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['WAVE', 'ORANGE_MONEY'],
      required: true,
      unique: true
    },
    label: {
      type: String,
      required: true
    },
    isEnabled: {
      type: Boolean,
      default: false
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentProviderConfig', paymentProviderConfigSchema);
