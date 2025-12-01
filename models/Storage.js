const mongoose = require('mongoose');

const storageSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: String,
  capacity: Number,
  capacityUnitEnum: ['M2', 'HA', 'L', 'M3'],
  availableFrom: Date,
  availableTo: Date,
  costPerKgPerDay: Number,
  productType: String,
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Storage', storageSchema);