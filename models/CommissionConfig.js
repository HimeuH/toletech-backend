const mongoose = require('mongoose');

/**
 * CommissionConfig — flexible commission rules for Toletech.
 *
 * Lookup priority (most specific wins):
 *   1. storageId match          → commission for this specific storage
 *   2. partnerId match          → commission for this specific partner (proprietaire / transporteur)
 *   3. transactionType default  → global default for STORAGE or TRANSPORT
 *   4. env fallback             → COMMISSION_STORAGE_PERCENT / COMMISSION_TRANSPORT_PERCENT
 */
const commissionConfigSchema = new mongoose.Schema(
  {
    transactionType: {
      type: String,
      enum: ['STORAGE', 'TRANSPORT'],
      required: true
    },
    mode: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      required: true
    },
    // For PERCENTAGE: value is 0–100 (e.g. 8 means 8%).
    // For FIXED: value is an XOF amount (e.g. 500).
    value: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'XOF'
    },
    // null = applies to all partners of this transactionType
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    // null = applies to all storages
    storageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Storage',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommissionConfig', commissionConfigSchema);
