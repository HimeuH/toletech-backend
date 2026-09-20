const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const sendResponse = require('../utils/sendResponse');
const Reservation = require('../models/Reservation');
const Billing = require('../models/Billing');
const Storage = require('../models/Storage');
const User = require('../models/User');
const Review = require('../models/Review');
const { toStorageUnit } = require('../utils/units');

// Temporary compatibility endpoints for the frontend already deployed on
// staging. Remove these in a follow-up after the redesigned frontend has been
// deployed and verified against GET /me/home.
exports.farmerDashboard = catchAsyncErrors(async (req, res) => {
  const userId = req.user.id;

  const [activeReservations, pendingPayments, recentHistory] = await Promise.all([
    Reservation.countDocuments({ user: userId, status: { $in: ['APPROUVÉ', 'CONFIRMÉ'] } }),
    Billing.find({ user: userId, status: 'PENDING' })
      .populate('storage', 'name location address')
      .sort({ createdAt: 1 }),
    Reservation.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('storage', 'name location address')
  ]);

  sendResponse(res, 200, { activeReservations, pendingPayments, recentHistory });
});

exports.ownerDashboard = catchAsyncErrors(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const storages = await Storage.find({ owner: req.user.id });
  const storageIds = storages.map(s => s._id);

  const [pendingRequests, monthlyRevenue] = await Promise.all([
    Reservation.countDocuments({ storage: { $in: storageIds }, status: 'EN_ATTENTE' }),
    Billing.aggregate([
      {
        $match: {
          storage: { $in: storageIds },
          status: 'PAID',
          paidAt: { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ])
  ]);

  sendResponse(res, 200, {
    totalStorages: storages.length,
    pendingRequests,
    monthlyRevenue: monthlyRevenue[0]?.total || 0
  });
});

exports.transporterDashboard = catchAsyncErrors(async (req, res) => {
  const userId = req.user.id;

  const [assignedTrips, pendingRequests, completedTrips, earningsAgg, user] = await Promise.all([
    Reservation.countDocuments({ transporter: userId, transportStatus: 'ACCEPTÉ' }),
    Reservation.countDocuments({ transporter: userId, transportStatus: 'DEMANDÉ' }),
    Reservation.countDocuments({ transporter: userId, transportStatus: 'LIVRÉ' }),
    Reservation.aggregate([
      { $match: { transporter: require('mongoose').Types.ObjectId.createFromHexString(userId.toString()), transportStatus: 'LIVRÉ' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$transportFee', 0] } } } },
    ]),
    User.findById(userId).select('isAvailableForTransport'),
  ]);

  sendResponse(res, 200, {
    assignedTrips,
    pendingRequests,
    completedTrips,
    totalEarnings: earningsAgg[0]?.total || 0,
    isAvailable: user?.isAvailableForTransport ?? false,
  });
});

// GET /api/v1/dashboard/admin
exports.adminDashboard = catchAsyncErrors(async (req, res, next) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsersToday,
    newUsersWeek,
    newUsersMonth,
    usersByRole,
    totalStorages,
    availableStorages,
    newStoragesThisMonth,
    occupationAgg,
    totalReservations,
    activeReservations,
    confirmedReservations,
    cancelledReservations,
    pendingOlderThan48h,
    reservationsByStatus,
    reservationsByProduct,
    openDisputes,
    volumeAgg,
    revenueTotal,
    revenueThisMonth,
    revenueLastMonth,
    activeTransporters,
    ratingAgg,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } },
    ]),
    Storage.countDocuments(),
    Storage.countDocuments({ isAvailable: true }),
    Storage.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Storage.aggregate([
      { $match: { capacity: { $gt: 0 } } },
      { $project: { rate: { $divide: [{ $ifNull: ['$reservedCapacity', 0] }, '$capacity'] } } },
      { $group: { _id: null, avg: { $avg: '$rate' } } },
    ]),
    Reservation.countDocuments(),
    Reservation.countDocuments({ status: { $in: ['APPROUVÉ', 'CONFIRMÉ'] } }),
    Reservation.countDocuments({ status: 'CONFIRMÉ' }),
    Reservation.countDocuments({ status: 'ANNULÉ' }),
    Reservation.countDocuments({ status: 'EN_ATTENTE', createdAt: { $lte: fortyEightHoursAgo } }),
    Reservation.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } },
    ]),
    Reservation.aggregate([
      { $match: { product: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { product: '$_id', count: 1, _id: 0 } },
    ]),
    Reservation.countDocuments({ 'dispute.status': 'OPEN' }),
    Reservation.aggregate([
      { $match: { status: 'CONFIRMÉ', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$quantity', 0] } } } },
    ]),
    Billing.aggregate([
      { $match: { status: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Billing.aggregate([
      { $match: { status: 'PAID', paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Billing.aggregate([
      { $match: { status: 'PAID', paidAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    User.countDocuments({ roles: 'TRANSPORTEUR', isAvailableForTransport: true }),
    Review.aggregate([
      { $match: { isVisible: true } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ]);

  const total = totalReservations || 1;
  const conversionRate = Math.round((confirmedReservations / total) * 100);
  const cancellationRate = Math.round((cancelledReservations / total) * 100);
  const avgOccupationRate = Math.round((occupationAgg[0]?.avg ?? 0) * 100);

  sendResponse(res, 200, {
    users: {
      total: totalUsers,
      newToday: newUsersToday,
      newWeek: newUsersWeek,
      newMonth: newUsersMonth,
      byRole: usersByRole,
    },
    storages: {
      total: totalStorages,
      available: availableStorages,
      newThisMonth: newStoragesThisMonth,
      avgOccupationRate,
    },
    reservations: {
      total: totalReservations,
      active: activeReservations,
      confirmed: confirmedReservations,
      cancelled: cancelledReservations,
      pendingOlderThan48h,
      conversionRate,
      cancellationRate,
      byStatus: reservationsByStatus,
      byProduct: reservationsByProduct,
      openDisputes,
      volumeThisMonth: volumeAgg[0]?.total || 0,
    },
    revenue: {
      total: revenueTotal[0]?.total || 0,
      thisMonth: revenueThisMonth[0]?.total || 0,
      lastMonth: revenueLastMonth[0]?.total || 0,
    },
    transporters: { active: activeTransporters },
    platform: {
      avgRating: Math.round((ratingAgg[0]?.avg ?? 0) * 10) / 10,
      reviewCount: ratingAgg[0]?.count ?? 0,
    },
  });
});

// B18 — GET /api/v1/dashboard/admin/series?metric=revenue|occupation&range=<days>
// Powers the admin overview's "over time" charts (redesign plan §5.6/§8.2).
exports.adminSeries = catchAsyncErrors(async (req, res, next) => {
  const metric = req.query.metric === 'occupation' ? 'occupation' : 'revenue';
  const range = Math.min(90, Math.max(7, parseInt(req.query.range, 10) || 30));

  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (range - 1));

  const days = [];
  for (let i = 0; i < range; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const dayKey = (d) => d.toISOString().slice(0, 10);

  if (metric === 'revenue') {
    const rows = await Billing.aggregate([
      { $match: { status: 'PAID', paidAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, total: { $sum: '$totalAmount' } } },
    ]);
    const byDay = new Map(rows.map(r => [r._id, r.total]));
    const series = days.map(d => ({ date: dayKey(d), value: byDay.get(dayKey(d)) || 0 }));
    return sendResponse(res, 200, { metric, range, series });
  }

  // occupation: Storage.reservedCapacity is only a live running total (no
  // history kept), so past occupancy is rebuilt here from the reservations
  // that were active on each day instead of a stored daily snapshot.
  const [storages, reservations] = await Promise.all([
    Storage.find({ capacity: { $gt: 0 } }).select('capacity capacityUnit'),
    Reservation.find({
      status: { $in: ['APPROUVÉ', 'CONFIRMÉ'] },
      reservedFrom: { $lte: end },
      reservedTo: { $gte: start },
    }).select('storage quantity quantityUnit reservedFrom reservedTo'),
  ]);

  const storageById = new Map(storages.map(s => [s._id.toString(), s]));

  const series = days.map(day => {
    const usedByStorage = new Map();
    for (const r of reservations) {
      if (!r.storage || r.reservedFrom > day || r.reservedTo < day) continue;
      const storage = storageById.get(r.storage.toString());
      if (!storage) continue;
      const converted = toStorageUnit(r.quantity, r.quantityUnit, storage.capacityUnit);
      if (converted === null) continue;
      const key = storage._id.toString();
      usedByStorage.set(key, (usedByStorage.get(key) || 0) + converted);
    }
    const ratios = storages.map(s => Math.min(1, (usedByStorage.get(s._id.toString()) || 0) / s.capacity));
    const avg = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
    return { date: dayKey(day), value: Math.round(avg * 1000) / 10 };
  });

  sendResponse(res, 200, { metric, range, series });
});
