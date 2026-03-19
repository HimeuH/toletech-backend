const mongoose = require('mongoose');

const storageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Legacy field — kept for backwards compatibility
    location: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      street: String,
      city: String,
      region: String,
      country: { type: String, default: 'Sénégal' }
    },
    gpsCoordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] } // [longitude, latitude]
    },
    storageType: {
      type: String,
      enum: ['SILO', 'HANGAR', 'CHAMBRE_FROIDE'],
      required: true
    },
    description: String,
    facilities: [String],
    accessHours: String,
    photos: [
      {
        public_id: String,
        url: String
      }
    ],
    capacity: {
      type: Number,
      required: true
    },
    capacityUnit: {
      type: String,
      enum: ['M2', 'HA', 'L', 'M3', 'TONNES'],
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
    },

    // S2: automated stock tracking
    reservedCapacity: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

storageSchema.index({ gpsCoordinates: '2dsphere' });

// Virtual: capacity still available for new reservations
storageSchema.virtual('availableCapacity').get(function () {
  return Math.max(0, (this.capacity || 0) - (this.reservedCapacity || 0));
});

// Include virtuals in JSON responses
storageSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Storage', storageSchema);
