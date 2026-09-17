const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const Reservation = require('../models/Reservation');
const Storage = require('../models/Storage');
const Billing = require('../models/Billing');
const Notification = require('../models/Notification');

/**
 * me.controller.js — B6/B7 (redesign plan §7, §3.3): one aggregate call for
 * the AppShell's Accueil tab (badges.perRole feeds the "espaces" switcher
 * chips, stats/recent feed the role home) and one for the cross-role "À
 * faire" inbox, instead of the front firing 4 separate /dashboard/* calls
 * plus a pending-missions call plus an unread-count call on every load.
 *
 * Only AGRICULTEUR / PROPRIETAIRE / TRANSFORMATEUR / TRANSPORTEUR get real
 * stats+recent+todo here — those are the three role homes Phase 2 rebuilds
 * (plan §8.2). AGENT/ADMIN keep using GET /dashboard/{agent via users,admin}
 * until their turn in Phase 5; they still get a badge count so the switcher
 * chip isn't blank.
 */

async function farmerTodo(userId) {
  const [toConfirm, pendingBillings] = await Promise.all([
    Reservation.find({ user: userId, status: 'APPROUVÉ' })
      .select('storage')
      .populate('storage', 'name')
      .sort({ createdAt: -1 })
      .limit(10),
    Billing.find({ user: userId, status: 'PENDING' })
      .select('storage totalAmount')
      .populate('storage', 'name')
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  return [
    ...toConfirm.map(r => ({
      id: `res-confirm-${r._id}`,
      type: 'RESERVATION_TO_CONFIRM',
      title: 'Réservation approuvée — à confirmer',
      subtitle: r.storage?.name || 'Entrepôt',
      link: `/reservations/${r._id}/detail`,
      priority: 'normal',
    })),
    ...pendingBillings.map(b => ({
      id: `bill-${b._id}`,
      type: 'PAYMENT_DUE',
      title: 'Paiement en attente',
      subtitle: b.storage?.name || 'Facture',
      link: `/facturation/${b._id}/detail`,
      priority: 'high',
    })),
  ];
}

async function farmerHome(userId) {
  const [activeReservations, pendingPayments, recent, todo] = await Promise.all([
    Reservation.countDocuments({ user: userId, status: { $in: ['APPROUVÉ', 'CONFIRMÉ'] } }),
    Billing.countDocuments({ user: userId, status: 'PENDING' }),
    Reservation.find({ user: userId }).sort({ createdAt: -1 }).limit(5).populate('storage', 'name'),
    farmerTodo(userId),
  ]);

  return {
    stats: [
      { label: 'Réservations actives', value: activeReservations },
      { label: 'Paiements en attente', value: pendingPayments },
    ],
    recent: recent.map(r => ({
      id: r._id,
      title: r.storage?.name || 'Entrepôt',
      status: r.status,
      link: `/reservations/${r._id}/detail`,
    })),
    todo,
  };
}

async function ownerTodo(userId) {
  const storages = await Storage.find({ owner: userId }).select('name');
  const storageIds = storages.map(s => s._id);
  const nameById = new Map(storages.map(s => [s._id.toString(), s.name]));

  const pending = await Reservation.find({ storage: { $in: storageIds }, status: 'EN_ATTENTE' })
    .select('storage user')
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(10);

  return pending.map(r => ({
    id: `res-respond-${r._id}`,
    type: 'RESERVATION_TO_RESPOND',
    title: `Nouvelle demande de ${r.user?.name || 'un agriculteur'}`,
    subtitle: nameById.get(r.storage?.toString()) || 'Entrepôt',
    link: `/reservations/${r._id}/detail`,
    priority: 'normal',
  }));
}

async function ownerHome(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const storages = await Storage.find({ owner: userId });
  const storageIds = storages.map(s => s._id);

  const [pendingRequests, monthlyRevenueAgg, recent, todo] = await Promise.all([
    Reservation.countDocuments({ storage: { $in: storageIds }, status: 'EN_ATTENTE' }),
    Billing.aggregate([
      { $match: { storage: { $in: storageIds }, status: 'PAID', paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Reservation.find({ storage: { $in: storageIds } }).sort({ createdAt: -1 }).limit(5).populate('storage', 'name'),
    ownerTodo(userId),
  ]);

  return {
    stats: [
      { label: 'Entrepôts', value: storages.length },
      { label: 'Demandes en attente', value: pendingRequests },
      { label: 'Revenus du mois', value: monthlyRevenueAgg[0]?.total || 0 },
    ],
    recent: recent.map(r => ({
      id: r._id,
      title: r.storage?.name || 'Entrepôt',
      status: r.status,
      link: `/reservations/${r._id}/detail`,
    })),
    todo,
    // §5.3 step 1 — one CapacityGauge card per storage on the owner's Accueil.
    storages: storages.map(s => ({
      id: s._id,
      name: s.name,
      capacity: s.capacity || 0,
      reservedCapacity: s.reservedCapacity || 0,
      capacityUnit: s.capacityUnit,
    })),
  };
}

async function transporterTodo(userId) {
  const missions = await Reservation.find({ transporter: userId, transportStatus: 'DEMANDÉ' })
    .select('storage')
    .populate('storage', 'name')
    .sort({ createdAt: -1 })
    .limit(10);

  return missions.map(r => ({
    id: `mission-${r._id}`,
    type: 'MISSION_TO_RESPOND',
    title: 'Nouvelle mission de transport',
    subtitle: r.storage?.name || 'Entrepôt',
    link: `/transport/missions/${r._id}`,
    priority: 'normal',
  }));
}

async function transporterHome(userId) {
  const [assignedTrips, pendingRequests, completedTrips, earningsAgg, recent, todo] = await Promise.all([
    Reservation.countDocuments({ transporter: userId, transportStatus: 'ACCEPTÉ' }),
    Reservation.countDocuments({ transporter: userId, transportStatus: 'DEMANDÉ' }),
    Reservation.countDocuments({ transporter: userId, transportStatus: 'LIVRÉ' }),
    Reservation.aggregate([
      { $match: { transporter: require('mongoose').Types.ObjectId.createFromHexString(userId.toString()), transportStatus: 'LIVRÉ' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$transportFee', 0] } } } },
    ]),
    Reservation.find({ transporter: userId }).sort({ transportRequestedAt: -1 }).limit(5).populate('storage', 'name'),
    transporterTodo(userId),
  ]);

  return {
    stats: [
      { label: 'Missions en cours', value: assignedTrips },
      { label: 'Missions en attente', value: pendingRequests },
      { label: 'Gains', value: earningsAgg[0]?.total || 0 },
    ],
    recent: recent.map(r => ({
      id: r._id,
      title: r.storage?.name || 'Entrepôt',
      status: r.transportStatus,
      link: `/transport/missions/${r._id}`,
    })),
    todo,
  };
}

/** Cheap count-only badge per role the user holds — feeds the "espaces" switcher chips. */
async function badgeFor(userId, role, storageIds) {
  switch (role) {
    case 'AGRICULTEUR':
      return Reservation.countDocuments({ user: userId, status: 'APPROUVÉ' });
    case 'PROPRIETAIRE':
    case 'TRANSFORMATEUR':
      return Reservation.countDocuments({ storage: { $in: storageIds }, status: 'EN_ATTENTE' });
    case 'TRANSPORTEUR':
      return Reservation.countDocuments({ transporter: userId, transportStatus: 'DEMANDÉ' });
    case 'ADMIN': {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      return Reservation.countDocuments({ status: 'EN_ATTENTE', createdAt: { $lte: fortyEightHoursAgo } });
    }
    default:
      return 0;
  }
}

async function computeBadgesPerRole(user) {
  const roles = user.roles || [];
  const needsStorageIds = roles.some(r => r === 'PROPRIETAIRE' || r === 'TRANSFORMATEUR');
  const storageIds = needsStorageIds ? (await Storage.find({ owner: user.id }).select('_id')).map(s => s._id) : [];

  const entries = await Promise.all(roles.map(async role => [role, await badgeFor(user.id, role, storageIds)]));
  return Object.fromEntries(entries);
}

// GET /api/v1/me/home?role=AGRICULTEUR — one call for the Accueil tab (B6).
exports.getHome = catchAsyncErrors(async (req, res, next) => {
  const roles = req.user.roles || [];
  const requestedRole = req.query.role;
  const role = requestedRole && roles.includes(requestedRole) ? requestedRole : roles[0];
  if (!role) return next(new ErrorHandler('Ce compte n\'a aucun rôle actif', 400, 'NO_ROLE'));

  const [roleData, badges, unread] = await Promise.all([
    role === 'AGRICULTEUR'
      ? farmerHome(req.user.id)
      : role === 'PROPRIETAIRE' || role === 'TRANSFORMATEUR'
      ? ownerHome(req.user.id)
      : role === 'TRANSPORTEUR'
      ? transporterHome(req.user.id)
      : Promise.resolve({ stats: [], recent: [], todo: [] }),
    computeBadgesPerRole(req.user),
    Notification.countDocuments({ user: req.user.id, isRead: false }),
  ]);

  const firstName = (req.user.name || '').trim().split(/\s+/)[0] || '';
  res.status(200).json({
    success: true,
    data: {
      greeting: firstName ? `Bonjour ${firstName}` : 'Bonjour',
      role,
      stats: roleData.stats,
      recent: roleData.recent,
      todo: roleData.todo,
      storages: roleData.storages,
      badges: { perRole: badges, unread },
    },
  });
});

// GET /api/v1/me/todo — cross-role action items for the "À faire" inbox (B7).
exports.getTodo = catchAsyncErrors(async (req, res) => {
  const roles = req.user.roles || [];
  const perRole = await Promise.all(
    roles.map(async role => {
      let items = [];
      if (role === 'AGRICULTEUR') items = await farmerTodo(req.user.id);
      else if (role === 'PROPRIETAIRE' || role === 'TRANSFORMATEUR') items = await ownerTodo(req.user.id);
      else if (role === 'TRANSPORTEUR') items = await transporterTodo(req.user.id);
      return items.map(item => ({ ...item, role }));
    }),
  );

  const todo = perRole.flat().sort((a, b) => (a.priority === 'high' ? -1 : 0) - (b.priority === 'high' ? -1 : 0));
  res.status(200).json({ success: true, data: { todo } });
});
