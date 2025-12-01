const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storage: { type: mongoose.Schema.Types.ObjectId, ref: 'Storage', required: true },

  totalAmount: { type: Number, required: true },
  currency: { type: String, default: "XOF" },
  days: { type: Number, required: true },        // nombre de jours facturés

  status: {
    type: String,
    enum: ["PENDING", "PAID", "CANCELLED"],
    default: 'EN_ATTENTE_PAIEMENT'
  },
    paidAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Billing', billingSchema);