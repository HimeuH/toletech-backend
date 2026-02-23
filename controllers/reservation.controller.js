const Reservation = require('../models/Reservation');
const Storage = require('../models/Storage');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');

exports.createReservation = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.create({
    ...req.body,
    user: req.user.id
  });
  res.status(201).json({ success: true, data: reservation });
});

exports.getReservationByStatus = catchAsyncErrors(async (req, res, next) => {
  const reservations = await Reservation.find({ status: req.params.status });
  res.status(200).json({ success: true, data: reservations, count: reservations.length });
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

exports.updateReservation = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

  let reservation = await Reservation.findById(id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (req.user.role !== 'ADMIN' && reservation.user?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  if (req.user.role !== 'ADMIN') {
    if (reservation.status !== 'EN_ATTENTE') {
      return next(new ErrorHandler('Only pending reservations can be updated', 403));
    }
    if (updates.status && updates.status !== 'ANNULÉ') {
      return next(new ErrorHandler('Only admin can confirm reservations', 403));
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
      status: 'CONFIRMÉ',
      reservedFrom: { $lt: newTo },
      reservedTo: { $gt: newFrom }
    });

    if (overlapping) return next(new ErrorHandler('Storage already reserved in this period', 400));
  }

  reservation = await Reservation.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, message: 'Reservation updated successfully', data: reservation });
});

// Get reservation by ID
exports.getReservationById = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id)
    .populate('user', 'name email')
    .populate({ path: 'storage', populate: { path: 'owner', select: 'name email' } });

  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  const isOwner = reservation.user?._id?.toString() === req.user.id;
  const isStorageOwner = reservation.storage?.owner?._id?.toString() === req.user.id;

  if (req.user.role !== 'ADMIN' && !isOwner && !isStorageOwner) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  res.status(200).json({ success: true, data: reservation });
});

// Delete reservation
exports.deleteReservation = catchAsyncErrors(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return next(new ErrorHandler('Reservation not found', 404));

  if (req.user.role !== 'ADMIN' && reservation.user?.toString() !== req.user.id) {
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

  if (req.user.role === 'AGRICULTEUR') {
    query.user = req.user.id;
    if (storage) query.storage = storage;
  } else if (req.user.role === 'PROPRIETAIRE' || req.user.role === 'TRANSFORMATEUR') {
    const ownedStorages = await Storage.find({ owner: req.user.id }).select('_id');
    query.storage = { $in: ownedStorages.map((s) => s._id) };
  } else if (req.user.role === 'AGENT' || req.user.role === 'ADMIN') {
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
