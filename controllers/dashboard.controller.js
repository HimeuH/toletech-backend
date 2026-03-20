const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const sendResponse = require('../utils/sendResponse');
const Reservation = require('../models/Reservation');
const Billing = require('../models/Billing');
const Storage = require('../models/Storage');
const User = require('../models/User');
const Review = require('../models/Review');

// GET /api/v1/dashboard/farmer
exports.farmerDashboard = catchAsyncErrors(async (req, res, next) => {
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

// GET /api/v1/dashboard/owner
exports.ownerDashboard = catchAsyncErrors(async (req, res, next) => {
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
