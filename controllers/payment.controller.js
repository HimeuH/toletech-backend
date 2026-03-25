/**
 * payment.controller.js
 *
 * Handles the checkout initiation and webhook processing for all payment providers.
 * Commission logic is delegated to utils/payment.js (computeCommission).
 * Wallet crediting is delegated to billing.controller.js (processPaidBilling).
 */
const Billing = require('../models/Billing');
const Transaction = require('../models/Transaction');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const payment = require('../utils/payment');
const { processPaidBilling } = require('./billing.controller');

// ---------------------------------------------------------------------------
// POST /api/v1/payments/checkout
// Body: { billingId, provider?, successUrl?, errorUrl? }
// ---------------------------------------------------------------------------
exports.initiateCheckout = catchAsyncErrors(async (req, res, next) => {
  const { billingId, provider, successUrl, errorUrl } = req.body;
  if (!billingId) return next(new ErrorHandler('billingId is required', 400));

  const activeProvider = (provider || process.env.DEFAULT_PAYMENT_PROVIDER || 'WAVE').toUpperCase();

  const billing = await Billing.findById(billingId).populate('user', 'name');
  if (!billing) return next(new ErrorHandler('Billing not found', 404));
  if (billing.status !== 'PENDING') {
    return next(new ErrorHandler('Billing is already paid or cancelled', 400));
  }

  // Only the payer or an admin can initiate checkout
  if (
    billing.user?._id?.toString() !== req.user.id &&
    !req.user.roles.includes('ADMIN')
  ) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:4200';
  const session = await payment.createCheckout(activeProvider, {
    amount: billing.totalAmount,
    currency: billing.currency || 'XOF',
    clientRef: billing._id.toString(),
    successUrl: successUrl || `${frontendBase}/payment/success?billing=${billing._id}`,
    errorUrl: errorUrl || `${frontendBase}/payment/error?billing=${billing._id}`
  });

  billing.checkoutSessionId = session.id;
  billing.paymentProvider = activeProvider;
  await billing.save();

  res.status(200).json({
    success: true,
    checkoutUrl: session.checkoutUrl,
    sessionId: session.id,
    provider: activeProvider
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/payments/webhook/:provider
// Raw body required — mounted with express.raw() in app.js before express.json()
// ---------------------------------------------------------------------------
exports.handleWebhook = async (req, res) => {
  const { provider } = req.params;
  const rawBody = req.body; // Buffer, preserved by express.raw()
  const signature =
    req.headers['wave-signature'] ||
    req.headers['x-orange-signature'] ||
    '';

  let event;
  try {
    event = payment.verifyWebhook(provider.toUpperCase(), rawBody, signature);
  } catch (err) {
    console.error(`[webhook:${provider}] Signature error:`, err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Wave sends checkout.session.completed; normalise across providers
  const isPaymentSuccess =
    event.type === 'checkout.session.completed' ||
    event.status === 'succeeded' ||
    event.status === 'COMPLETED';

  if (!isPaymentSuccess) {
    return res.status(200).json({ received: true });
  }

  const sessionId = event.id || event.checkout_session_id;
  if (!sessionId) {
    return res.status(200).json({ received: true });
  }

  const billing = await Billing.findOne({ checkoutSessionId: sessionId });

  // Idempotent — if already paid, just acknowledge
  if (!billing || billing.status === 'PAID') {
    return res.status(200).json({ received: true });
  }

  billing.status = 'PAID';
  billing.paidAt = new Date();
  billing.providerRef = event.transaction_id || event.id;
  billing.providerStatus = event.status;
  await billing.save();

  // Commission deduction + wallet crediting (same as manual admin PAID flow)
  try {
    await processPaidBilling(billing);
  } catch (err) {
    console.error(`[webhook:${provider}] processPaidBilling error:`, err.message);
    // Do not return 500 — the payment succeeded; internal processing is retried manually
  }

  return res.status(200).json({ received: true });
};

// ---------------------------------------------------------------------------
// GET /api/v1/payments/history
// Returns the authenticated user's billing + transaction history
// ---------------------------------------------------------------------------
exports.getPaymentHistory = catchAsyncErrors(async (req, res) => {
  const query = req.user.roles.includes('ADMIN') ? {} : { user: req.user.id };

  const billings = await Billing.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('reservation', 'reservedFrom reservedTo status')
    .populate('storage', 'name');

  res.status(200).json({ success: true, data: billings });
});

// ---------------------------------------------------------------------------
// GET /api/v1/payments/commission-configs — admin only
// ---------------------------------------------------------------------------
exports.getCommissionConfigs = catchAsyncErrors(async (req, res) => {
  const CommissionConfig = require('../models/CommissionConfig');
  const configs = await CommissionConfig.find()
    .populate('partnerId', 'name email')
    .populate('storageId', 'name');
  res.status(200).json({ success: true, data: configs });
});

// ---------------------------------------------------------------------------
// POST /api/v1/payments/commission-configs — admin only
// ---------------------------------------------------------------------------
exports.createCommissionConfig = catchAsyncErrors(async (req, res, next) => {
  const CommissionConfig = require('../models/CommissionConfig');
  const { transactionType, mode, value, currency, partnerId, storageId } = req.body;

  if (!transactionType || !mode || value === undefined) {
    return next(new ErrorHandler('transactionType, mode and value are required', 400));
  }

  const config = await CommissionConfig.create({
    transactionType,
    mode,
    value,
    currency,
    partnerId: partnerId || null,
    storageId: storageId || null
  });

  res.status(201).json({ success: true, data: config });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/payments/commission-configs/:id — admin only
// ---------------------------------------------------------------------------
exports.updateCommissionConfig = catchAsyncErrors(async (req, res, next) => {
  const CommissionConfig = require('../models/CommissionConfig');
  const config = await CommissionConfig.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!config) return next(new ErrorHandler('Commission config not found', 404));
  res.status(200).json({ success: true, data: config });
});
