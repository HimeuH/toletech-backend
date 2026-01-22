const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema(
  {
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    storage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Storage'
    },
    totalAmount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'XOF'
    },
    days: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED'],
      default: 'PENDING'
    },
    paidAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Billing', billingSchema);
