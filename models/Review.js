const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    // Who wrote the review (always an AGRICULTEUR)
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // What is being reviewed
    targetType: {
      type: String,
      enum: ['TRANSPORTER', 'STORAGE'],
      required: true
    },
    // ObjectId of the transporter (User) or the storage (Storage)
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetRef'
    },

    // The real reservation this review is linked to (required)
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true
    },

    // Review content
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true
    },

    // Admin moderation
    isVisible: { type: Boolean, default: true },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date
  },
  { timestamps: true }
);

// Dynamic ref helper (not used by Mongoose directly, but kept for documentation)
reviewSchema.virtual('targetRef').get(function () {
  return this.targetType === 'STORAGE' ? 'Storage' : 'User';
});

// One review per reviewer per reservation per targetType
reviewSchema.index({ reviewer: 1, reservation: 1, targetType: 1 }, { unique: true });

// Fast lookup of all reviews for a given target
reviewSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('Review', reviewSchema);
