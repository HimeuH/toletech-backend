const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  storage: { type: mongoose.Schema.Types.ObjectId, ref: 'Storage' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reservedFrom: Date,
  reservedTo: Date,
  status: {
    type: String,
    enum: ['EN_ATTENTE', 'CONFIRMÉ', 'ANNULÉ'],
    default: 'EN_ATTENTE'
  }
}, { timestamps: true });

module.exports = mongoose.model('Reservation', reservationSchema);