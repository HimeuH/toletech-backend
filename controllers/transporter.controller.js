const User = require('../models/User');
const Review = require('../models/Review');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');
const mongoose = require('mongoose');

// GET /api/v1/transporters — list available transporters, filter by zone
exports.listTransporters = catchAsyncErrors(async (req, res, next) => {
  const { zone, page, limit } = req.query;
  const query = { roles: 'TRANSPORTEUR', isAvailableForTransport: true };
  if (zone) {
    query.serviceZones = { $in: [zone] };
  }

  const result = await paginate(User, query, page, limit);

  // Inject avg rating for each transporter
  const ids = result.data.map(u => u._id);
  const ratings = await Review.aggregate([
    { $match: { targetType: 'TRANSPORTER', targetId: { $in: ids }, isVisible: true } },
    { $group: { _id: '$targetId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  const ratingMap = {};
  ratings.forEach(r => { ratingMap[r._id.toString()] = { avg: r.avg, count: r.count }; });

  const data = result.data.map(u => {
    const plain = u.toObject ? u.toObject() : u;
    const r = ratingMap[plain._id.toString()];
    return { ...plain, averageRating: r ? Math.round(r.avg * 10) / 10 : 0, reviewCount: r?.count ?? 0 };
  });

  res.status(200).json({ success: true, ...result, data });
});

// GET /api/v1/transporters/:id — transporter public profile + avg rating
exports.getTransporterProfile = catchAsyncErrors(async (req, res, next) => {
  const transporter = await User.findOne({ _id: req.params.id, roles: 'TRANSPORTEUR' })
    .select('name phone email avatar vehicleType vehicleCapacity vehiclePlate serviceZones isAvailableForTransport createdAt');

  if (!transporter) return next(new ErrorHandler('Transporteur introuvable', 404));

  const result = await Review.aggregate([
    {
      $match: {
        targetType: 'TRANSPORTER',
        targetId: new mongoose.Types.ObjectId(req.params.id),
        isVisible: true
      }
    },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  const plain = transporter.toObject();
  plain.averageRating = result.length ? Math.round(result[0].avg * 10) / 10 : 0;
  plain.reviewCount = result.length ? result[0].count : 0;

  res.status(200).json({ success: true, data: plain });
});

// PUT /api/v1/transporters/availability — transporter toggles own availability
exports.updateAvailability = catchAsyncErrors(async (req, res, next) => {
  const { isAvailableForTransport } = req.body;
  if (typeof isAvailableForTransport !== 'boolean') {
    return next(new ErrorHandler('isAvailableForTransport must be a boolean', 400));
  }

  await User.findByIdAndUpdate(req.user.id, { isAvailableForTransport });
  res.status(200).json({ success: true, message: 'Disponibilité mise à jour' });
});
