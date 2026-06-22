const User = require('../models/User');
const Review = require('../models/Review');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');
const mongoose = require('mongoose');
const { computeEstimate } = require('../utils/senegalCities');

// GET /api/v1/transporters — list available transporters, optionally filter by zone + estimate price
exports.listTransporters = catchAsyncErrors(async (req, res, next) => {
  const { zone, from, to, page, limit } = req.query;
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
    const priceEstimate = computeEstimate(plain.transportPricing, from, to);
    return {
      ...plain,
      averageRating: r ? Math.round(r.avg * 10) / 10 : 0,
      reviewCount: r?.count ?? 0,
      priceEstimate
    };
  });

  res.status(200).json({ success: true, ...result, data });
});

// GET /api/v1/transporters/:id — transporter public profile + avg rating + price estimate
exports.getTransporterProfile = catchAsyncErrors(async (req, res, next) => {
  const { from, to } = req.query;

  const transporter = await User.findOne({ _id: req.params.id, roles: 'TRANSPORTEUR' })
    .select('name phone email avatar vehicleType vehicleCapacity vehiclePlate serviceZones isAvailableForTransport transportPricing createdAt');

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
  plain.priceEstimate = computeEstimate(plain.transportPricing, from, to);

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

// PUT /api/v1/transporters/pricing — transporter sets own pricing
exports.setPricing = catchAsyncErrors(async (req, res, next) => {
  const { mode, perKmRate, fixedRoutes } = req.body;

  const VALID_MODES = ['FIXED_ROUTES', 'PER_KM', 'BOTH'];
  if (!VALID_MODES.includes(mode)) {
    return next(new ErrorHandler(`mode doit être l'une des valeurs : ${VALID_MODES.join(', ')}`, 400));
  }

  if ((mode === 'PER_KM' || mode === 'BOTH') && (!perKmRate || perKmRate <= 0)) {
    return next(new ErrorHandler('perKmRate (XOF/km) est requis pour ce mode', 400));
  }

  if ((mode === 'FIXED_ROUTES' || mode === 'BOTH') && (!Array.isArray(fixedRoutes) || fixedRoutes.length === 0)) {
    return next(new ErrorHandler('fixedRoutes est requis pour ce mode', 400));
  }

  // Validate each fixed route
  if (Array.isArray(fixedRoutes)) {
    for (const route of fixedRoutes) {
      if (!route.from || !route.to || !route.price || route.price <= 0) {
        return next(new ErrorHandler('Chaque route fixe doit avoir from, to et price (> 0)', 400));
      }
    }
  }

  const transportPricing = { mode };
  if (perKmRate) transportPricing.perKmRate = perKmRate;
  if (Array.isArray(fixedRoutes)) transportPricing.fixedRoutes = fixedRoutes;

  await User.findByIdAndUpdate(req.user.id, { transportPricing });
  res.status(200).json({ success: true, message: 'Tarifs mis à jour', data: transportPricing });
});
