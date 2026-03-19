const Review = require('../models/Review');
const Reservation = require('../models/Reservation');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');

// POST /api/v1/reviews — AGRICULTEUR submits a review after a validated reservation
exports.createReview = catchAsyncErrors(async (req, res, next) => {
  const { targetType, targetId, reservation: reservationId, rating, comment } = req.body;

  if (!['TRANSPORTER', 'STORAGE'].includes(targetType)) {
    return next(new ErrorHandler('targetType must be TRANSPORTER or STORAGE', 400));
  }
  if (!rating || rating < 1 || rating > 5) {
    return next(new ErrorHandler('rating must be between 1 and 5', 400));
  }

  // Verify the reservation exists and belongs to the reviewer
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (reservation.user?.toString() !== req.user.id) {
    return next(new ErrorHandler('You can only review your own reservations', 403));
  }

  if (reservation.status !== 'CONFIRMÉ') {
    return next(new ErrorHandler('Reviews are only allowed after a confirmed reservation', 400));
  }

  // For TRANSPORTER review: reservation must have been delivered
  if (targetType === 'TRANSPORTER') {
    if (reservation.transportStatus !== 'LIVRÉ') {
      return next(new ErrorHandler('Transport review requires a delivered mission', 400));
    }
    if (reservation.transporter?.toString() !== targetId) {
      return next(new ErrorHandler('Transporter does not match this reservation', 400));
    }
  }

  // For STORAGE review: verify targetId matches the storage
  if (targetType === 'STORAGE' && reservation.storage?.toString() !== targetId) {
    return next(new ErrorHandler('Storage does not match this reservation', 400));
  }

  const review = await Review.create({
    reviewer: req.user.id,
    targetType,
    targetId,
    reservation: reservationId,
    rating,
    comment: comment || undefined
  });

  res.status(201).json({ success: true, data: review });
});

// GET /api/v1/reviews?targetType=STORAGE&targetId=... — public listing
exports.getReviews = catchAsyncErrors(async (req, res, next) => {
  const { targetType, targetId, page = 1, limit = 10 } = req.query;

  const query = { isVisible: true };
  if (targetType) query.targetType = targetType;
  if (targetId) query.targetId = targetId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('reviewer', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: reviews,
    count: total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page)
  });
});

// GET /api/v1/reviews/summary?targetType=STORAGE&targetId=... — avg rating
exports.getReviewSummary = catchAsyncErrors(async (req, res, next) => {
  const { targetType, targetId } = req.query;
  if (!targetType || !targetId) {
    return next(new ErrorHandler('targetType and targetId are required', 400));
  }

  const result = await Review.aggregate([
    { $match: { targetType, targetId: require('mongoose').Types.ObjectId.createFromHexString(targetId), isVisible: true } },
    { $group: { _id: null, averageRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    data: result.length
      ? { targetType, targetId, averageRating: Math.round(result[0].averageRating * 10) / 10, count: result[0].count }
      : { targetType, targetId, averageRating: 0, count: 0 }
  });
});

// PUT /api/v1/reviews/:id/moderate — ADMIN toggles visibility
exports.moderateReview = catchAsyncErrors(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new ErrorHandler('Review not found', 404));

  review.isVisible = req.body.isVisible !== undefined ? req.body.isVisible : !review.isVisible;
  review.moderatedBy = req.user.id;
  review.moderatedAt = new Date();
  await review.save();

  res.status(200).json({ success: true, data: review });
});

// DELETE /api/v1/reviews/:id — ADMIN deletes a review
exports.deleteReview = catchAsyncErrors(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new ErrorHandler('Review not found', 404));

  await Review.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Review deleted' });
});
