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
      enum: ['EN_ATTENTE', 'CONFIRMÉ', 'ANNULÉ'],
      default: 'EN_ATTENTE'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
