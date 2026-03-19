const Reservation = require('../models/Reservation');
const Storage = require('../models/Storage');
const Billing = require('../models/Billing');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');
const notify = require('../utils/notify');

exports.createReservation = catchAsyncErrors(async (req, res, next) => {
  // BE-024: agent proxy — reserve on behalf of a farmer
  let userId = req.user.id;
  if (req.user.roles.includes('AGENT') && req.body.onBehalfOf) {
    const User = require('../models/User');
    const farmer = await User.findById(req.body.onBehalfOf);
    if (!farmer || !farmer.roles.includes('AGRICULTEUR')) {
      return next(new ErrorHandler('Invalid farmer specified for onBehalfOf', 400));
    }
    userId = req.body.onBehalfOf;
  }

  const reservation = await Reservation.create({
    ...req.body,
    user: userId,
    createdBy: req.user.id,
    statusHistory: [{ status: 'EN_ATTENTE', changedBy: req.user.id }]
  });

  // BE-020: notify storage owner of new request
  const storage = await Storage.findById(reservation.storage).select('owner name');
  if (storage && storage.owner) {
    await notify(
      storage.owner,
      'RESERVATION_REQUESTED',
      'Nouvelle demande de réservation',
      `${req.user.name} a demandé une réservation pour ${storage.name || 'votre entrepôt'}`,
      { reservationId: reservation._id, storageId: storage._id }
    ).catch(err => console.error('Notification error:', err.message));
  }

  res.status(201).json({ success: true, data: reservation });
});

// Get all reservations (admin)
exports.getAllReservations = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await paginate(
    Reservation, {}, page, limit,
    [{ path: 'user', select: 'name email phone' }, { path: 'storage', select: 'name location' }]
  );
  res.status(200).json({ success: true, ...result });
});

// Get reservations for current user
exports.getMyReservations = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await paginate(
    Reservation, { user: req.user.id }, page, limit,
    { path: 'storage', select: 'name location address' }
  );
  res.status(200).json({ success: true, ...result });
});

// BE-015: Owner reservation dashboard
exports.getOwnerReservations = catchAsyncErrors(async (req, res, next) => {
  const storageIds = await Storage.find({ owner: req.user.id }).select('_id');
  const query = { storage: { $in: storageIds.map(s => s._id) } };

  if (req.query.status) query.status = req.query.status;
  if (req.query.storageId) query.storage = req.query.storageId;

  const { page, limit } = req.query;
  const result = await paginate(
    Reservation, query, page, limit,
    [{ path: 'user', select: 'name email phone' }, { path: 'storage', select: 'name location address' }]
  );
  res.status(200).json({ success: true, ...result });
});

exports.updateReservation = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

  const reservation = await Reservation.findById(id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (!req.user.roles.includes('ADMIN') && reservation.user?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  // Status transition rules (BE-013)
  if (updates.status && updates.status !== reservation.status) {
    if (!req.user.roles.includes('ADMIN')) {
      // Non-admin users (farmers) can only cancel
      if (updates.status !== 'ANNULÉ') {
        return next(new ErrorHandler('Only admin can change to this status', 403));
      }
      if (reservation.status !== 'EN_ATTENTE') {
        return next(new ErrorHandler('Cannot cancel a reservation in this state', 400));
      }
    } else {
      // Admin: enforce valid transitions
      const validTransitions = {
        EN_ATTENTE: ['APPROUVÉ', 'REJETÉ', 'ANNULÉ'],
        APPROUVÉ: ['CONFIRMÉ', 'ANNULÉ'],
        CONFIRMÉ: [],
        REJETÉ: [],
        ANNULÉ: []
      };
      if (!validTransitions[reservation.status]?.includes(updates.status)) {
        return next(new ErrorHandler(`Cannot transition from ${reservation.status} to ${updates.status}`, 400));
      }
    }
  }

  if (updates.reservedFrom && updates.reservedTo) {
    const from = new Date(updates.reservedFrom);
    const to = new Date(updates.reservedTo);

    if (from >= to) return next(new ErrorHandler('reservedFrom must be before reservedTo', 400));
    if (from < new Date()) return next(new ErrorHandler('Reservation cannot start in the past', 400));
  }

  if (updates.reservedFrom || updates.reservedTo) {
    const newFrom = new Date(updates.reservedFrom || reservation.reservedFrom);
    const newTo = new Date(updates.reservedTo || reservation.reservedTo);

    const overlapping = await Reservation.findOne({
      _id: { $ne: reservation._id },
      storage: reservation.storage,
      status: { $in: ['CONFIRMÉ', 'APPROUVÉ'] },
      reservedFrom: { $lt: newTo },
      reservedTo: { $gt: newFrom }
    });

    if (overlapping) return next(new ErrorHandler('Storage already reserved in this period', 400));
  }

  // Apply editable fields
  const editableFields = ['reservedFrom', 'reservedTo', 'notes', 'quantity', 'quantityUnit'];
  editableFields.forEach(field => {
    if (updates[field] !== undefined) reservation[field] = updates[field];
  });

  // Status change + statusHistory (BE-016)
  if (updates.status && updates.status !== reservation.status) {
    reservation.status = updates.status;
    if (updates.ownerMessage !== undefined) reservation.ownerMessage = updates.ownerMessage;
    reservation.statusHistory.push({
      status: updates.status,
      changedBy: req.user.id,
      message: updates.message || ''
    });
  }

  await reservation.save();

  // BE-020: notify owner when farmer cancels
  if (updates.status === 'ANNULÉ') {
    const storage = await Storage.findById(reservation.storage).select('owner name');
    if (storage && storage.owner) {
      await notify(
        storage.owner,
        'RESERVATION_CANCELLED',
        'Réservation annulée',
        `Une réservation pour ${storage.name || 'votre entrepôt'} a été annulée`,
        { reservationId: reservation._id, storageId: storage._id }
      ).catch(err => console.error('Notification error:', err.message));
    }
  }

  // BE-017: Auto-billing on confirmation
  if (updates.status === 'CONFIRMÉ') {
    const existingBilling = await Billing.findOne({ reservation: reservation._id });
    if (!existingBilling) {
      const { generateBilling } = require('./billing.controller');
      await generateBilling(reservation._id);
    }
  }

  res.status(200).json({ success: true, message: 'Reservation updated successfully', data: reservation });
});

// BE-014: Owner approve/reject endpoint
exports.respondToReservation = catchAsyncErrors(async (req, res, next) => {
  const { action, message } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return next(new ErrorHandler('Action must be "approve" or "reject"', 400));
  }

  const reservation = await Reservation.findById(req.params.id).populate('storage');
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (reservation.status !== 'EN_ATTENTE') {
    return next(new ErrorHandler('Only pending reservations can be responded to', 400));
  }

  // Verify caller owns the storage (or is ADMIN)
  if (!req.user.roles.includes('ADMIN') && reservation.storage?.owner?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  reservation.status = action === 'approve' ? 'APPROUVÉ' : 'REJETÉ';
  reservation.ownerMessage = message || '';
  reservation.statusHistory.push({
    status: reservation.status,
    changedBy: req.user.id,
    message: message || ''
  });

  await reservation.save();

  // BE-020: notify farmer of approval/rejection (with SMS for critical events — BE-021)
  const notifType = reservation.status === 'APPROUVÉ' ? 'RESERVATION_APPROVED' : 'RESERVATION_REJECTED';
  const notifTitle = reservation.status === 'APPROUVÉ' ? 'Réservation approuvée' : 'Réservation rejetée';
  const notifMessage = message || `Votre réservation a été ${reservation.status.toLowerCase()}`;
  await notify(
    reservation.user,
    notifType,
    notifTitle,
    notifMessage,
    { reservationId: reservation._id },
    { sms: true }
  ).catch(err => console.error('Notification error:', err.message));

  res.status(200).json({ success: true, message: `Reservation ${reservation.status}`, data: reservation });
});

// Get reservation by ID
exports.getReservationById = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id)
    .populate('user', 'name email')
    .populate({ path: 'storage', populate: { path: 'owner', select: 'name email' } });

  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  const isOwner = reservation.user?._id?.toString() === req.user.id;
  const isStorageOwner = reservation.storage?.owner?._id?.toString() === req.user.id;

  if (!req.user.roles.includes('ADMIN') && !isOwner && !isStorageOwner) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  res.status(200).json({ success: true, data: reservation });
});

// Delete reservation
exports.deleteReservation = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (!req.user.roles.includes('ADMIN') && reservation.user?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  await Reservation.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Deleted successfully' });
});

// Search reservations by user, storage or status
exports.searchReservations = catchAsyncErrors(async (req, res, next) => {
  const { user, storage, status, page, limit } = req.query;
  const query = {};

  if (status) query.status = status;

  const userRoles = req.user.roles || [];
  if (userRoles.includes('AGRICULTEUR') && !userRoles.includes('ADMIN') && !userRoles.includes('AGENT')) {
    query.user = req.user.id;
    if (storage) query.storage = storage;
  } else if (userRoles.some(r => ['PROPRIETAIRE', 'TRANSFORMATEUR'].includes(r)) && !userRoles.includes('ADMIN')) {
    const ownedStorages = await Storage.find({ owner: req.user.id }).select('_id');
    query.storage = { $in: ownedStorages.map((s) => s._id) };
  } else if (userRoles.includes('AGENT') || userRoles.includes('ADMIN')) {
    if (user) query.user = user;
    if (storage) query.storage = storage;
  } else {
    return next(new ErrorHandler('Forbidden', 403));
  }

  const result = await paginate(
    Reservation, query, page, limit,
    [{ path: 'user', select: 'name email phone' }, { path: 'storage', select: 'name location address' }]
  );
  res.status(200).json({ success: true, ...result });
});
