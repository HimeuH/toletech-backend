const Billing = require('../models/Billing');
const Reservation = require('../models/Reservation');
const Storage = require('../models/Storage');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');

// Internal helper — called by reservation controller on confirmation
exports.generateBilling = async (reservationId) => {
  const reservation = await Reservation.findById(reservationId)
    .populate('storage')
    .populate('user');

  if (!reservation) throw new Error('Réservation introuvable');
  if (reservation.status !== 'CONFIRMÉ')
    throw new Error('La réservation doit être CONFIRMÉE avant facturation');

  const storage = reservation.storage;

  const start = new Date(reservation.reservedFrom);
  const end = new Date(reservation.reservedTo);
  const diffTime = Math.abs(end - start);
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const totalAmount = days * (storage.costPerKgPerDay || 0);

  const billing = await Billing.create({
    reservation: reservation._id,
    user: reservation.user._id,
    storage: storage._id,
    totalAmount,
    days,
  });

  return billing;
};

// GET /api/v1/billings — admin only
exports.getAllBillings = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await paginate(Billing, {}, page, limit, [
    { path: 'user', select: 'name email' },
    { path: 'storage', select: 'name location' },
    'reservation'
  ]);
  res.status(200).json({ success: true, ...result });
});

// GET /api/v1/billings/my — farmer or owner
exports.getMyBillings = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  let query = {};

  if (req.user.role === 'AGRICULTEUR') {
    query.user = req.user.id;
  } else if (req.user.role === 'PROPRIETAIRE' || req.user.role === 'TRANSFORMATEUR') {
    const storages = await Storage.find({ owner: req.user.id }).select('_id');
    query.storage = { $in: storages.map(s => s._id) };
  } else if (req.user.role === 'ADMIN') {
    // admin can use this endpoint too — no filter
  } else {
    return next(new ErrorHandler('Forbidden', 403));
  }

  const result = await paginate(Billing, query, page, limit, [
    { path: 'user', select: 'name email' },
    { path: 'storage', select: 'name location' },
    'reservation'
  ]);
  res.status(200).json({ success: true, ...result });
});

// GET /api/v1/billings/storage/:storageId
exports.getBillingsByStorage = catchAsyncErrors(async (req, res, next) => {
  const storage = await Storage.findById(req.params.storageId);
  if (!storage) return next(new ErrorHandler('Storage not found', 404));

  if (req.user.role !== 'ADMIN' && storage.owner?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  const { page, limit } = req.query;
  const result = await paginate(Billing, { storage: req.params.storageId }, page, limit);
  res.status(200).json({ success: true, ...result });
});

// GET /api/v1/billings/:id
exports.getBillingById = catchAsyncErrors(async (req, res, next) => {
  const billing = await Billing.findById(req.params.id)
    .populate('reservation')
    .populate('user', 'name email')
    .populate('storage', 'name location');

  if (!billing) return next(new ErrorHandler('Billing not found', 404));

  const isOwner = billing.user?._id?.toString() === req.user.id;
  const storageDoc = await Storage.findById(billing.storage?._id);
  const isStorageOwner = storageDoc?.owner?.toString() === req.user.id;

  if (req.user.role !== 'ADMIN' && !isOwner && !isStorageOwner) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  res.status(200).json({ success: true, data: billing });
});

// PUT /api/v1/billings/:id/status — admin only
exports.updateBillingStatus = catchAsyncErrors(async (req, res, next) => {
  const { status } = req.body;

  if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) {
    return next(new ErrorHandler('Invalid billing status', 400));
  }

  const billing = await Billing.findById(req.params.id);
  if (!billing) return next(new ErrorHandler('Billing not found', 404));

  billing.status = status;
  if (status === 'PAID') billing.paidAt = new Date();
  await billing.save();

  res.status(200).json({ success: true, data: billing });
});
