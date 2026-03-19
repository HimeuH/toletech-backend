const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT', 'COMMISSION', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'PAYOUT'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    },
    relatedReservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation'
    },
    relatedBilling: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Billing'
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'COMPLETED'
    },
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
