const mongoose = require('mongoose');

const storageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    capacity: {
      type: Number,
      required: true
    },
    capacityUnit: {
      type: String,
      enum: ['M2', 'HA', 'L', 'M3'],
      required: true
    },
    availableFrom: {
      type: Date,
      required: true
    },
    availableTo: {
      type: Date,
      required: true
    },
    costPerKgPerDay: {
      type: Number,
      required: true
    },
    productType: String,
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Storage', storageSchema);
