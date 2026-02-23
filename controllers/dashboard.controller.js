const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const sendResponse = require('../utils/sendResponse');
const Reservation = require('../models/Reservation');
const Billing = require('../models/Billing');
const Storage = require('../models/Storage');
const StorageSpace = require('../models/StorageSpace');
const User = require('../models/User');

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

  const [totalSpaces, occupiedSpaces, pendingRequests, monthlyRevenue] = await Promise.all([
    StorageSpace.countDocuments({ storage: { $in: storageIds } }),
    StorageSpace.countDocuments({ storage: { $in: storageIds }, status: 'OCCUPÉ' }),
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
    totalSpaces,
    occupiedSpaces,
    occupationRate: totalSpaces ? ((occupiedSpaces / totalSpaces) * 100).toFixed(1) : 0,
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

  const [
    usersByRole,
    newUsersToday,
    newUsersWeek,
    newUsersMonth,
    totalStorages,
    totalReservations,
    reservationsByStatus,
    revenueTotal
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Storage.countDocuments(),
    Reservation.countDocuments(),
    Reservation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Billing.aggregate([
      { $match: { status: 'PAID' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ])
  ]);

  sendResponse(res, 200, {
    users: {
      byRole: usersByRole,
      newToday: newUsersToday,
      newWeek: newUsersWeek,
      newMonth: newUsersMonth
    },
    storages: { total: totalStorages },
    reservations: { total: totalReservations, byStatus: reservationsByStatus },
    revenue: { total: revenueTotal[0]?.total || 0 }
  });
});
