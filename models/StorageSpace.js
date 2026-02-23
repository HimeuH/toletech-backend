const mongoose = require('mongoose');

const storageSpaceSchema = new mongoose.Schema(
  {
    storage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Storage',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true },
    capacityUnit: {
      type: String,
      enum: ['M2', 'HA', 'L', 'M3', 'TONNES'],
      required: true
    },
    price: { type: Number, required: true },
    pricingPeriod: {
      type: String,
      enum: ['DAILY', 'MONTHLY', 'SEASONAL'],
      required: true
    },
    availableFrom: Date,
    availableTo: Date,
    status: {
      type: String,
      enum: ['DISPONIBLE', 'OCCUPÉ', 'MAINTENANCE'],
      default: 'DISPONIBLE'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StorageSpace', storageSpaceSchema);
