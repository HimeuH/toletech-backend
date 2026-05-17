const Billing = require('../models/Billing');
const Reservation = require('../models/Reservation');
const Storage = require('../models/Storage');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');
const { computeCommission } = require('../utils/payment');

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

  const storageAmount = days * (storage.costPerKgPerDay || 0);
  const transportAmount = reservation.needsTransport ? (reservation.transportFee || 0) : 0;
  const totalAmount = storageAmount + transportAmount;

  const billing = await Billing.create({
    reservation: reservation._id,
    user: reservation.user._id,
    storage: storage._id,
    totalAmount,
    storageAmount,
    transportAmount,
    days,
  });

  // S4-BE-03: create ESCROW_HOLD for the storage owner
  try {
    const { createEscrowHold } = require('./wallet.controller');
    await createEscrowHold(
      storage.owner,
      totalAmount,
      `Escrow — réservation #${reservation._id}`,
      { relatedReservation: reservation._id, relatedBilling: billing._id }
    );
  } catch (err) {
    console.error('Wallet escrow error:', err.message);
  }

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

  const userRoles = req.user.roles || [];
  if (userRoles.includes('AGRICULTEUR') && !userRoles.includes('ADMIN')) {
    query.user = req.user.id;
  } else if (userRoles.some(r => ['PROPRIETAIRE', 'TRANSFORMATEUR'].includes(r)) && !userRoles.includes('ADMIN')) {
    const storages = await Storage.find({ owner: req.user.id }).select('_id');
    query.storage = { $in: storages.map(s => s._id) };
  } else if (userRoles.includes('ADMIN')) {
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

  if (!req.user.roles.includes('ADMIN') && storage.owner?.toString() !== req.user.id) {
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

  if (!req.user.roles.includes('ADMIN') && !isOwner && !isStorageOwner) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  res.status(200).json({ success: true, data: billing });
});

/**
 * processPaidBilling — shared helper called when a billing transitions to PAID.
 * Deducts commission (using CommissionConfig or env fallback), credits owner wallet,
 * and records all transactions.
 * Exported so the payment webhook controller can reuse it without duplication.
 */
// Internal helper — credit transporter wallet for a delivered+paid billing
exports.creditTransporterWallet = async (billing, reservation) => {
  if (!billing.transportAmount || billing.transporterPaidAt) return;
  if (!reservation.transporter) return;

  const { creditWallet } = require('./wallet.controller');
  const { commissionAmount, mode, value } = await computeCommission(
    billing.transportAmount,
    'TRANSPORT',
    { partnerId: reservation.transporter }
  );
  const net = billing.transportAmount - commissionAmount;

  await creditWallet(
    reservation.transporter,
    net,
    `Paiement transport — facture #${billing._id}`,
    { relatedBilling: billing._id, type: 'TRANSPORT_PAYMENT' }
  );

  await Billing.findByIdAndUpdate(billing._id, { transporterPaidAt: new Date() });

  const notify = require('../utils/notify');
  const commissionLabel = mode === 'FIXED' ? `${commissionAmount} XOF` : `${value}%`;
  await notify(
    reservation.transporter,
    'TRANSPORT_PAYMENT_RECEIVED',
    'Paiement transport reçu',
    `Vous avez reçu ${net} XOF pour la livraison (facture #${billing._id}, commission ${commissionLabel} déduite).`,
    { billingId: billing._id },
    { sms: true }
  ).catch(err => console.error('[notify] transporter payment:', err.message));
};

exports.processPaidBilling = async (billing) => {
  const populatedBilling = await Billing.findById(billing._id)
    .populate('user', '_id')
    .populate({ path: 'reservation', populate: { path: 'storage', select: 'owner name' } });
  const ownerId = populatedBilling?.reservation?.storage?.owner;
  if (!ownerId) return;

  const reservation = populatedBilling.reservation;
  const storageId = reservation?.storage?._id;
  const { commissionAmount, mode, value } = await computeCommission(
    billing.storageAmount || billing.totalAmount,
    'STORAGE',
    { partnerId: ownerId, storageId }
  );
  const net = (billing.storageAmount || billing.totalAmount) - commissionAmount;

  const { creditWallet, getOrCreateWallet } = require('./wallet.controller');
  const Transaction = require('../models/Transaction');
  const wallet = await getOrCreateWallet(ownerId);

  const commissionLabel = mode === 'FIXED'
    ? `Commission Toletech (${commissionAmount} XOF fixe) — facture #${billing._id}`
    : `Commission Toletech (${value}%) — facture #${billing._id}`;

  await Transaction.create({
    wallet: wallet._id,
    type: 'COMMISSION',
    amount: commissionAmount,
    description: commissionLabel,
    relatedBilling: billing._id,
    status: 'COMPLETED',
    processedAt: new Date()
  });

  await creditWallet(
    ownerId,
    net,
    `Paiement net stockage — facture #${billing._id}`,
    { relatedBilling: billing._id, type: 'ESCROW_RELEASE' }
  );

  await Billing.findByIdAndUpdate(billing._id, { storagePaidAt: new Date() });

  const notify = require('../utils/notify');
  const storageName = reservation?.storage?.name || 'votre entrepôt';
  const farmerId = populatedBilling?.user?._id;

  // Notify owner: wallet credited
  await notify(
    ownerId,
    'PAYMENT_RECEIVED',
    'Paiement reçu',
    `Vous avez reçu ${net} XOF pour ${storageName} (facture #${billing._id}, commission ${commissionAmount} XOF déduite).`,
    { billingId: billing._id },
    { sms: true }
  ).catch(err => console.error('[notify] owner payment:', err.message));

  // Notify farmer: payment confirmed
  if (farmerId) {
    await notify(
      farmerId,
      'PAYMENT_CONFIRMED',
      'Paiement confirmé',
      `Votre paiement de ${billing.totalAmount} XOF pour la facture #${billing._id} a bien été reçu.`,
      { billingId: billing._id },
      { sms: true }
    ).catch(err => console.error('[notify] farmer payment:', err.message));
  }

  // Credit transporter immediately if delivery already confirmed
  if (billing.transportAmount > 0 && reservation?.transportStatus === 'LIVRÉ') {
    await exports.creditTransporterWallet(billing, reservation).catch(err =>
      console.error('[notify] transporter wallet:', err.message)
    );
  }
};

// PUT /api/v1/billings/:id/status — admin only
exports.updateBillingStatus = catchAsyncErrors(async (req, res, next) => {
  const { status } = req.body;

  if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) {
    return next(new ErrorHandler('Invalid billing status', 400));
  }

  const billing = await Billing.findById(req.params.id);
  if (!billing) return next(new ErrorHandler('Billing not found', 404));

  billing.status = status;
  if (status === 'PAID') {
    billing.paidAt = new Date();
    await billing.save();

    try {
      await exports.processPaidBilling(billing);
    } catch (err) {
      console.error('Wallet credit error:', err.message);
    }
  } else {
    await billing.save();
  }

  res.status(200).json({ success: true, data: billing });
});
