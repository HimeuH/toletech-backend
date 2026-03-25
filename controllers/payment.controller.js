/**
 * payment.controller.js
 *
 * Handles the checkout initiation and webhook processing for all payment providers.
 * Commission logic is delegated to utils/payment.js (computeCommission).
 * Wallet crediting is delegated to billing.controller.js (processPaidBilling).
 */
const Billing = require('../models/Billing');
const Transaction = require('../models/Transaction');
const PaymentProviderConfig = require('../models/PaymentProviderConfig');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const payment = require('../utils/payment');
const { processPaidBilling } = require('./billing.controller');

// Default seed — auto-created on first GET /payments/providers
const DEFAULT_PROVIDERS = [
  { provider: 'WAVE', label: 'Wave', isEnabled: true },
  { provider: 'ORANGE_MONEY', label: 'Orange Money', isEnabled: false }
];

async function seedProviders() {
  for (const defaults of DEFAULT_PROVIDERS) {
    await PaymentProviderConfig.findOneAndUpdate(
      { provider: defaults.provider },
      { $setOnInsert: defaults },
      { upsert: true, new: true }
    );
  }
}

async function assertProviderEnabled(provider) {
  const config = await PaymentProviderConfig.findOne({ provider });
  if (!config || !config.isEnabled) {
    throw new ErrorHandler(`Le fournisseur de paiement "${provider}" est désactivé`, 400);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/payments/checkout
// Body: { billingId, provider?, successUrl?, errorUrl? }
// ---------------------------------------------------------------------------
exports.initiateCheckout = catchAsyncErrors(async (req, res, next) => {
  const { billingId, provider, successUrl, errorUrl } = req.body;
  if (!billingId) return next(new ErrorHandler('billingId is required', 400));

  const activeProvider = (provider || process.env.DEFAULT_PAYMENT_PROVIDER || 'WAVE').toUpperCase();

  await assertProviderEnabled(activeProvider);

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

  // Wave requires HTTPS — use backend (ngrok) as redirect proxy so local dev works
  const backendBase = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const session = await payment.createCheckout(activeProvider, {
    amount: billing.totalAmount,
    currency: billing.currency || 'XOF',
    clientRef: billing._id.toString(),
    successUrl: `${backendBase}/api/v1/payments/redirect/success?billing=${billing._id}`,
    errorUrl: `${backendBase}/api/v1/payments/redirect/error?billing=${billing._id}`
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
// GET /api/v1/payments/redirect/success|error
// Wave calls these HTTPS URLs, we redirect the browser to the local frontend
// ---------------------------------------------------------------------------
exports.redirectSuccess = (req, res) => {
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:4200';
  const billing = req.query.billing || '';
  res.redirect(`${frontendBase}/#/facturation/payment/success?billing=${billing}`);
};

exports.redirectError = (req, res) => {
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:4200';
  const billing = req.query.billing || '';
  res.redirect(`${frontendBase}/#/facturation/payment/error?billing=${billing}`);
};

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

  // Wave payload: { type: 'checkout.session.completed', data: { id, payment_status, transaction_id, client_reference, ... } }
  const data = event.data || event; // normalise: Wave wraps in data, OM may not
  const paymentStatus = data.payment_status || data.status || '';
  const isPaymentSuccess =
    event.type === 'checkout.session.completed'
      ? paymentStatus === 'succeeded'
      : paymentStatus === 'succeeded' || paymentStatus === 'COMPLETED';

  if (!isPaymentSuccess) {
    console.log(`[webhook:${provider}] payment_status="${paymentStatus}" — not succeeded, ignoring`);
    return res.status(200).json({ received: true });
  }

  const sessionId = data.id || data.checkout_session_id;
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
  billing.providerRef = data.transaction_id || data.id;
  billing.providerStatus = paymentStatus;
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

// ---------------------------------------------------------------------------
// GET /api/v1/payments/providers
// Returns all provider configs (seeded on first call).
// Authenticated users see the full list so the UI knows what to show.
// ---------------------------------------------------------------------------
exports.getProviders = catchAsyncErrors(async (req, res) => {
  await seedProviders();
  const configs = await PaymentProviderConfig.find().sort({ provider: 1 });
  res.status(200).json({ success: true, data: configs });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/payments/providers/:provider — admin only
// Body: { isEnabled: boolean }
// ---------------------------------------------------------------------------
exports.toggleProvider = catchAsyncErrors(async (req, res, next) => {
  const { provider } = req.params;
  const { isEnabled } = req.body;

  if (typeof isEnabled !== 'boolean') {
    return next(new ErrorHandler('isEnabled (boolean) is required', 400));
  }

  const config = await PaymentProviderConfig.findOneAndUpdate(
    { provider: provider.toUpperCase() },
    { isEnabled, updatedBy: req.user.id },
    { new: true }
  );

  if (!config) return next(new ErrorHandler('Provider not found', 404));

  res.status(200).json({ success: true, data: config });
});
