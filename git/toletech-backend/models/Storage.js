const mongoose = require('mongoose');

const storageSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: String,
  capacity: Number,
  availableFrom: Date,
  availableTo: Date,
  productType: String,
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Storage', storageSchema);