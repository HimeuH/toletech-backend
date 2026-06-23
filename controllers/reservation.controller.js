const Reservation = require('../models/Reservation');
const Storage = require('../models/Storage');
const Billing = require('../models/Billing');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');
const notify = require('../utils/notify');

// Helper: convert quantity to storage capacityUnit for comparison (best-effort)
const toStorageUnit = (quantity, quantityUnit, capacityUnit) => {
  if (!quantity || !quantityUnit || !capacityUnit) return null;
  if (quantityUnit === capacityUnit) return quantity;
  // KG ↔ TONNES
  if (quantityUnit === 'KG' && capacityUnit === 'TONNES') return quantity / 1000;
  if (quantityUnit === 'TONNES' && capacityUnit === 'KG') return quantity * 1000;
  // Cannot compare across incompatible units (e.g. SACS vs M2) — skip check
  return null;
};

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

  // S2-BE-03: validate available capacity before creating
  if (req.body.quantity && req.body.storage) {
    const storage = await Storage.findById(req.body.storage).select('capacity reservedCapacity capacityUnit');
    if (storage) {
      const available = Math.max(0, (storage.capacity || 0) - (storage.reservedCapacity || 0));
      const converted = toStorageUnit(req.body.quantity, req.body.quantityUnit, storage.capacityUnit);
      if (converted !== null && converted > available) {
        return next(new ErrorHandler(
          `Capacité insuffisante. Disponible : ${available} ${storage.capacityUnit}, demandé : ${converted} ${storage.capacityUnit}`,
          400
        ));
      }
    }
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

// Get all reservations (admin) — S8-BE-03: filtres avancés
exports.getAllReservations = catchAsyncErrors(async (req, res, next) => {
  const { page, limit, status, userId, storageId, disputeStatus, dateFrom, dateTo } = req.query;
  const query = {};

  if (status) query.status = status;
  if (userId) query.user = userId;
  if (storageId) query.storage = storageId;
  if (disputeStatus) query['dispute.status'] = disputeStatus;
  if (dateFrom || dateTo) {
    query.reservedFrom = {};
    if (dateFrom) query.reservedFrom.$gte = new Date(dateFrom);
    if (dateTo) query.reservedFrom.$lte = new Date(dateTo);
  }

  const result = await paginate(
    Reservation, query, page, limit,
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
      // Non-admin users (farmers) can only cancel pending reservations
      if (updates.status !== 'ANNULÉ') {
        return next(new ErrorHandler('Only admin can change to this status', 403));
      }
      if (reservation.status !== 'EN_ATTENTE') {
        return next(new ErrorHandler('Cannot cancel a reservation in this state', 400));
      }
    } else {
      // Admin: enforce valid transitions (CONFIRMÉ → ANNULÉ allowed to free capacity)
      const validTransitions = {
        EN_ATTENTE: ['APPROUVÉ', 'REJETÉ', 'ANNULÉ'],
        APPROUVÉ: ['CONFIRMÉ', 'ANNULÉ'],
        CONFIRMÉ: ['ANNULÉ'],
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

  // Capture previous status before overwriting (needed for capacity logic below)
  const previousStatus = reservation.status;

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

  // S2-BE-02: atomic capacity updates on status transition
  if (updates.status && updates.status !== previousStatus && reservation.quantity) {
    const storage = await Storage.findById(reservation.storage).select('capacityUnit');
    const converted = storage
      ? (toStorageUnit(reservation.quantity, reservation.quantityUnit, storage.capacityUnit) ?? reservation.quantity)
      : reservation.quantity;

    if (updates.status === 'CONFIRMÉ') {
      // Lock capacity when reservation is confirmed
      await Storage.findByIdAndUpdate(reservation.storage, { $inc: { reservedCapacity: converted } });
    } else if (updates.status === 'ANNULÉ' && previousStatus === 'CONFIRMÉ') {
      // Free capacity when a confirmed reservation is cancelled (admin only path)
      await Storage.findByIdAndUpdate(reservation.storage, [
        { $set: { reservedCapacity: { $max: [0, { $subtract: ['$reservedCapacity', converted] }] } } }
      ]);
    }
  }

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
    .populate({ path: 'storage', populate: { path: 'owner', select: 'name email' } })
    .populate('transporter', 'name phone');

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

  // S2: free capacity if a confirmed reservation is deleted
  if (reservation.status === 'CONFIRMÉ' && reservation.quantity) {
    const storage = await Storage.findById(reservation.storage).select('capacityUnit');
    const converted = storage
      ? (toStorageUnit(reservation.quantity, reservation.quantityUnit, storage.capacityUnit) ?? reservation.quantity)
      : reservation.quantity;
    await Storage.findByIdAndUpdate(reservation.storage, [
      { $set: { reservedCapacity: { $max: [0, { $subtract: ['$reservedCapacity', converted] }] } } }
    ]);
  }

  await Reservation.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Deleted successfully' });
});

// S3-BE-03: Farmer requests a transporter for a confirmed reservation
exports.assignTransporter = catchAsyncErrors(async (req, res, next) => {
  const { transporterId, proposedTransportFee, pickupLocation } = req.body;

  if (!transporterId) return next(new ErrorHandler('transporterId est requis', 400));
  if (!proposedTransportFee || proposedTransportFee <= 0) {
    return next(new ErrorHandler('proposedTransportFee (XOF) est requis', 400));
  }

  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (reservation.status !== 'CONFIRMÉ') {
    return next(new ErrorHandler('Transport can only be assigned to confirmed reservations', 400));
  }

  // Only the farmer who owns the reservation or an admin can assign
  if (!req.user.roles.includes('ADMIN') && reservation.user?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  // Block if a request is already pending
  if (reservation.transportStatus === 'DEMANDÉ') {
    return next(new ErrorHandler('Une demande de transport est déjà en cours', 400));
  }
  if (reservation.transportStatus === 'ACCEPTÉ') {
    return next(new ErrorHandler('Un transporteur a déjà accepté cette mission', 400));
  }

  const User = require('../models/User');
  const transporter = await User.findOne({ _id: transporterId, roles: 'TRANSPORTEUR', isAvailableForTransport: true });
  if (!transporter) return next(new ErrorHandler('Transporteur non disponible', 404));

  reservation.transporter = transporterId;
  reservation.needsTransport = true;
  reservation.proposedTransportFee = proposedTransportFee;
  reservation.transportStatus = 'DEMANDÉ';
  reservation.transportRequestedAt = new Date();
  reservation.transportExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h window
  if (pickupLocation) reservation.pickupLocation = pickupLocation;
  await reservation.save();

  const templates = require('../utils/notificationTemplates');
  const tpl = templates.TRANSPORT_ASSIGNED({
    farmerName: req.user.name || 'Un agriculteur',
    storageName: reservation.storage?.toString() || 'entrepôt',
    proposedFee: proposedTransportFee
  });

  await notify(
    transporterId,
    'TRANSPORT_ASSIGNED',
    tpl.title,
    tpl.inApp,
    { reservationId: reservation._id },
    { sms: true, smsText: tpl.sms, waText: tpl.whatsapp }
  ).catch(err => console.error('Notification error:', err.message));

  res.status(200).json({ success: true, data: reservation });
});

// S3-BE-04: Transporter accepts the mission and locks the proposed fee
exports.acceptTransport = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (reservation.transporter?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  if (reservation.transportStatus !== 'DEMANDÉ') {
    return next(new ErrorHandler('Mission not in DEMANDÉ state', 400));
  }

  // Lock the agreed fee from farmer's proposal
  reservation.transportFee = reservation.proposedTransportFee;
  reservation.transportStatus = 'ACCEPTÉ';
  reservation.transportAcceptedAt = new Date();
  reservation.transportExpiresAt = undefined;
  await reservation.save();

  const User = require('../models/User');
  const transporter = await User.findById(req.user.id).select('name');

  const templates = require('../utils/notificationTemplates');
  const tpl = templates.TRANSPORT_ACCEPTED({
    transporterName: transporter?.name || 'Le transporteur',
    agreedFee: reservation.transportFee
  });

  await notify(
    reservation.user,
    'TRANSPORT_ACCEPTED',
    tpl.title,
    tpl.inApp,
    { reservationId: reservation._id },
    { sms: true, smsText: tpl.sms, waText: tpl.whatsapp }
  ).catch(err => console.error('Notification error:', err.message));

  res.status(200).json({ success: true, data: reservation });
});

// S3-BE-04b: Transporter rejects the mission — farmer can renegotiate and retry
exports.rejectTransport = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (reservation.transporter?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  if (reservation.transportStatus !== 'DEMANDÉ') {
    return next(new ErrorHandler('Mission not in DEMANDÉ state', 400));
  }

  const { note } = req.body;

  const User = require('../models/User');
  const transporter = await User.findById(req.user.id).select('name');

  // Keep transporter linked so they can see the rejected mission in history,
  // but mark as REJETÉ and clear fields so farmer can request a different transporter
  reservation.transportStatus = 'REJETÉ';
  reservation.needsTransport = false;
  reservation.proposedTransportFee = 0;
  reservation.transportRejectedAt = new Date();
  reservation.transportRejectionNote = note || '';
  reservation.transportExpiresAt = undefined;
  await reservation.save();

  const templates = require('../utils/notificationTemplates');
  const tpl = templates.TRANSPORT_REJECTED({
    transporterName: transporter?.name || 'Le transporteur',
    note: note || ''
  });

  await notify(
    reservation.user,
    'TRANSPORT_REJECTED',
    tpl.title,
    tpl.inApp,
    { reservationId: reservation._id },
    { sms: true, smsText: tpl.sms, waText: tpl.whatsapp }
  ).catch(err => console.error('Notification error:', err.message));

  res.status(200).json({ success: true, message: 'Demande de transport refusée' });
});

// S3-BE-05: Farmer cancels pending transport request
exports.cancelTransport = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  const isFarmer = reservation.user?.toString() === req.user.id;
  if (!isFarmer && !req.user.roles.includes('ADMIN')) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  if (reservation.transportStatus !== 'DEMANDÉ') {
    return next(new ErrorHandler('Aucune demande de transport en attente', 400));
  }

  reservation.transportStatus = 'NONE';
  reservation.needsTransport = false;
  reservation.transporter = undefined;
  reservation.proposedTransportFee = 0;
  reservation.pickupLocation = undefined;
  reservation.transportRequestedAt = undefined;
  reservation.transportExpiresAt = undefined;
  await reservation.save();

  res.status(200).json({ success: true, message: 'Demande de transport annulée' });
});

// S3-BE-04: Transporter confirms delivery
exports.confirmDelivery = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (reservation.transporter?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  if (reservation.transportStatus !== 'ACCEPTÉ') {
    return next(new ErrorHandler('Mission not in ACCEPTÉ state', 400));
  }

  reservation.transportStatus = 'LIVRÉ';
  reservation.deliveredAt = new Date();
  await reservation.save();

  // S3-BE-07: notify the farmer
  await notify(
    reservation.user,
    'TRANSPORT_DELIVERED',
    'Livraison confirmée',
    `Votre marchandise a été livrée`,
    { reservationId: reservation._id },
    { sms: true }
  ).catch(err => console.error('Notification error:', err.message));

  // Credit transporter immediately if billing already paid
  try {
    const Billing = require('../models/Billing');
    const { creditTransporterWallet } = require('./billing.controller');
    const billing = await Billing.findOne({ reservation: reservation._id, status: 'PAID' });
    if (billing && billing.transportAmount > 0 && !billing.transporterPaidAt) {
      await creditTransporterWallet(billing, reservation);
    }
  } catch (err) {
    console.error('[transport payment]', err.message);
  }

  res.status(200).json({ success: true, data: reservation });
});

// GET /api/v1/reservations/transport-missions — transporter sees their missions
exports.getTransportMissions = catchAsyncErrors(async (req, res, next) => {
  const { status, page, limit } = req.query;
  const query = { transporter: req.user.id };
  if (status) query.transportStatus = status;

  const result = await paginate(
    Reservation, query, page, limit,
    [{ path: 'user', select: 'name phone' }, { path: 'storage', select: 'name address location' }]
  );
  res.status(200).json({ success: true, ...result });
});

// S8-BE-02: Admin adjust reservation (dates, quantity, notes)
exports.adjustReservation = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  const { reservedFrom, reservedTo, quantity, quantityUnit, notes, message } = req.body;

  if (reservedFrom) reservation.reservedFrom = new Date(reservedFrom);
  if (reservedTo) reservation.reservedTo = new Date(reservedTo);
  if (quantity !== undefined) reservation.quantity = quantity;
  if (quantityUnit !== undefined) reservation.quantityUnit = quantityUnit;
  if (notes !== undefined) reservation.notes = notes;

  reservation.statusHistory.push({
    status: reservation.status,
    changedBy: req.user.id,
    message: message || 'Ajustement administrateur'
  });

  await reservation.save();

  // Notify the farmer of the adjustment
  await notify(
    reservation.user,
    'GENERAL',
    'Réservation ajustée',
    message || 'Votre réservation a été ajustée par un administrateur.',
    { reservationId: reservation._id }
  ).catch(err => console.error('Notification error:', err.message));

  res.status(200).json({ success: true, message: 'Reservation adjusted', data: reservation });
});

// S8-BE-02: Open a dispute on a reservation
exports.openDispute = catchAsyncErrors(async (req, res, next) => {
  const { reason, description } = req.body;
  if (!reason) return next(new ErrorHandler('reason is required', 400));

  const reservation = await Reservation.findById(req.params.id)
    .populate('storage', 'owner name');
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  // Only the farmer (reservation owner) or storage owner can open a dispute
  const isReservationOwner = reservation.user?.toString() === req.user.id;
  const isStorageOwner = reservation.storage?.owner?.toString() === req.user.id;
  if (!req.user.roles.includes('ADMIN') && !isReservationOwner && !isStorageOwner) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  if (reservation.dispute?.status === 'OPEN') {
    return next(new ErrorHandler('Un litige est déjà ouvert sur cette réservation', 400));
  }

  if (!['CONFIRMÉ', 'ANNULÉ'].includes(reservation.status)) {
    return next(new ErrorHandler('Les litiges ne peuvent être ouverts que sur des réservations confirmées ou annulées', 400));
  }

  reservation.dispute = {
    status: 'OPEN',
    reason,
    description: description || '',
    openedBy: req.user.id,
    openedAt: new Date()
  };

  reservation.statusHistory.push({
    status: reservation.status,
    changedBy: req.user.id,
    message: `Litige ouvert : ${reason}`
  });

  await reservation.save();

  // Notify admins — we notify the storage owner if opened by farmer, and vice versa
  const User = require('../models/User');
  const admins = await User.find({ roles: 'ADMIN' }).select('_id');
  const storageData = await Storage.findById(reservation.storage?._id || reservation.storage).select('name owner');
  const notifTargets = admins.map(a => a._id);
  if (isReservationOwner && storageData?.owner && storageData.owner.toString() !== req.user.id) {
    notifTargets.push(storageData.owner);
  }
  if (isStorageOwner) {
    notifTargets.push(reservation.user);
  }

  const opener = await User.findById(req.user.id).select('name');
  for (const targetId of notifTargets) {
    await notify(
      targetId,
      'GENERAL',
      'Nouveau litige ouvert',
      `${opener?.name || 'Un utilisateur'} a ouvert un litige sur une réservation (${storageData?.name || ''}). Motif : ${reason}`,
      { reservationId: reservation._id },
      { sms: false }
    ).catch(err => console.error('Notification error:', err.message));
  }

  res.status(200).json({ success: true, message: 'Dispute opened', data: reservation });
});

// S8-BE-02: Admin resolve a dispute
exports.resolveDispute = catchAsyncErrors(async (req, res, next) => {
  const { resolution } = req.body;
  if (!resolution) return next(new ErrorHandler('resolution is required', 400));

  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (reservation.dispute?.status !== 'OPEN') {
    return next(new ErrorHandler('No open dispute on this reservation', 400));
  }

  reservation.dispute.status = 'RESOLVED';
  reservation.dispute.resolvedBy = req.user.id;
  reservation.dispute.resolvedAt = new Date();
  reservation.dispute.resolution = resolution;

  reservation.statusHistory.push({
    status: reservation.status,
    changedBy: req.user.id,
    message: `Litige résolu : ${resolution}`
  });

  await reservation.save();

  const storageData = await Storage.findById(reservation.storage).select('name owner');

  // Notify farmer
  await notify(
    reservation.user,
    'GENERAL',
    'Litige résolu',
    `Votre litige sur "${storageData?.name || 'votre réservation'}" a été résolu. ${resolution}`,
    { reservationId: reservation._id },
    { sms: true }
  ).catch(err => console.error('Notification error:', err.message));

  // Notify storage owner
  if (storageData?.owner) {
    await notify(
      storageData.owner,
      'GENERAL',
      'Litige résolu',
      `Le litige sur "${storageData?.name || 'votre entrepôt'}" a été résolu par l'administration.`,
      { reservationId: reservation._id }
    ).catch(err => console.error('Notification error:', err.message));
  }

  res.status(200).json({ success: true, message: 'Dispute resolved', data: reservation });
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
