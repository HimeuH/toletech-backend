const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    storage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Storage'
    },
    reservedFrom: {
      type: Date,
      required: true
    },
    reservedTo: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['EN_ATTENTE', 'APPROUVÉ', 'REJETÉ', 'CONFIRMÉ', 'ANNULÉ'],
      default: 'EN_ATTENTE'
    },
    // BE-013: owner response
    ownerMessage: String,
    // BE-012: cargo details
    notes: String,
    quantity: Number,
    quantityUnit: {
      type: String,
      enum: ['KG', 'TONNES', 'SACS', 'LITRES']
    },
    // BE-024: audit trail — who actually created the record (agent proxy)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // BE-016: status change audit trail
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        message: String
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
