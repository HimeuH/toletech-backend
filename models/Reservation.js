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
      enum: ['EN_ATTENTE', 'APPROUVÉ', 'REJETÉ', 'CONFIRMÉ', 'ANNULÉ', 'VALIDÉ', 'LITIGE'],
      default: 'EN_ATTENTE'
    },
    // BE-013: owner response
    ownerMessage: String,
    // BE-012: cargo details
    product: { type: String, required: true },
    notes: String,
    quantity: Number,
    quantityUnit: {
      type: String,
      enum: ['KG', 'TONNES', 'LITRES']
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
    ],

    // S3-BE-01: transport integration
    needsTransport: { type: Boolean, default: false },
    pickupLocation: String,                       // where transporter picks up goods
    proposedTransportFee: { type: Number, default: 0 }, // fee proposed by farmer after phone negotiation
    transportFee: { type: Number, default: 0 },   // locked fee once transporter accepts
    transporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    transportStatus: {
      type: String,
      enum: ['NONE', 'DEMANDÉ', 'ACCEPTÉ', 'REJETÉ', 'LIVRÉ'],
      default: 'NONE'
    },
    transportRequestedAt: Date,
    transportAcceptedAt: Date,
    transportRejectedAt: Date,
    transportRejectionNote: String,               // optional note from transporter on rejection
    transportExpiresAt: Date,                     // auto-reset if transporter doesn't respond (48h)
    deliveredAt: Date,

    // S8-BE-01: litige
    dispute: {
      status: {
        type: String,
        enum: ['NONE', 'OPEN', 'RESOLVED'],
        default: 'NONE'
      },
      reason: String,
      description: String,
      openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      openedAt: Date,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      resolvedAt: Date,
      resolution: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
