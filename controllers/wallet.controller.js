const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');

// Helper: get or auto-create wallet for a user
exports.getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId });
  }
  return wallet;
};

// Helper: credit a wallet + record transaction
exports.creditWallet = async (userId, amount, description, opts = {}) => {
  const wallet = await exports.getOrCreateWallet(userId);
  wallet.balance += amount;
  wallet.totalEarned += amount;
  await wallet.save();

  const tx = await Transaction.create({
    wallet: wallet._id,
    type: 'CREDIT',
    amount,
    description,
    status: 'COMPLETED',
    processedAt: new Date(),
    ...opts
  });
  return { wallet, tx };
};

// Helper: create escrow hold (does NOT deduct from wallet — represents funds pending release)
exports.createEscrowHold = async (userId, amount, description, opts = {}) => {
  const wallet = await exports.getOrCreateWallet(userId);

  const tx = await Transaction.create({
    wallet: wallet._id,
    type: 'ESCROW_HOLD',
    amount,
    description,
    status: 'COMPLETED',
    processedAt: new Date(),
    ...opts
  });
  return { wallet, tx };
};

// GET /api/v1/wallet/me
exports.getMyWallet = catchAsyncErrors(async (req, res, next) => {
  const wallet = await exports.getOrCreateWallet(req.user.id);
  await wallet.populate('user', 'name email payoutFrequencyDays');
  res.status(200).json({ success: true, data: wallet });
});

// GET /api/v1/wallet/transactions
exports.getMyTransactions = catchAsyncErrors(async (req, res, next) => {
  const wallet = await exports.getOrCreateWallet(req.user.id);
  const { page, limit, type } = req.query;

  const query = { wallet: wallet._id };
  if (type) query.type = type;

  const result = await paginate(
    Transaction, query, page, limit,
    [{ path: 'relatedBilling', select: 'totalAmount status' }, { path: 'relatedReservation', select: 'status reservedFrom reservedTo' }],
    { createdAt: -1 }
  );

  res.status(200).json({ success: true, ...result });
});

// GET /api/v1/wallet/admin — admin: all wallets with balances
exports.getAllWallets = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await paginate(
    Wallet, {}, page, limit,
    { path: 'user', select: 'name email roles payoutFrequencyDays' },
    { balance: -1 }
  );
  res.status(200).json({ success: true, ...result });
});

// GET /api/v1/wallet/admin/summary — admin: platform-wide financial overview
exports.getAdminSummary = catchAsyncErrors(async (req, res, next) => {
  const [walletAgg, txAgg] = await Promise.all([
    Wallet.aggregate([
      { $group: { _id: null, totalBalance: { $sum: '$balance' }, totalEarned: { $sum: '$totalEarned' }, totalPaidOut: { $sum: '$totalPaidOut' } } }
    ]),
    Transaction.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ])
  ]);

  const byType = {};
  txAgg.forEach(t => { byType[t._id] = { total: t.total, count: t.count }; });

  res.status(200).json({
    success: true,
    data: {
      wallets: walletAgg[0] || { totalBalance: 0, totalEarned: 0, totalPaidOut: 0 },
      transactions: byType
    }
  });
});

// POST /api/v1/wallet/admin/payout — admin triggers manual payout for a user
exports.adminPayout = catchAsyncErrors(async (req, res, next) => {
  const { userId, amount } = req.body;
  if (!userId || !amount || amount <= 0) {
    return next(new ErrorHandler('userId et amount sont requis', 400));
  }

  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) return next(new ErrorHandler('Wallet introuvable', 404));

  if (wallet.balance < amount) {
    return next(new ErrorHandler(`Solde insuffisant. Disponible: ${wallet.balance} XOF`, 400));
  }

  wallet.balance -= amount;
  wallet.totalPaidOut += amount;
  wallet.lastPayoutAt = new Date();
  await wallet.save();

  const tx = await Transaction.create({
    wallet: wallet._id,
    type: 'PAYOUT',
    amount,
    description: `Paiement manuel — admin`,
    status: 'COMPLETED',
    processedAt: new Date()
  });

  res.status(200).json({ success: true, data: { wallet, transaction: tx } });
});

// PUT /api/v1/wallet/payout-frequency — user sets own payout frequency
exports.updatePayoutFrequency = catchAsyncErrors(async (req, res, next) => {
  const { payoutFrequencyDays } = req.body;

  if (!payoutFrequencyDays || payoutFrequencyDays < 1) {
    return next(new ErrorHandler('payoutFrequencyDays must be >= 1', 400));
  }

  const allowed = req.user.roles || [];
  if (!allowed.some(r => ['PROPRIETAIRE', 'TRANSFORMATEUR', 'TRANSPORTEUR', 'ADMIN'].includes(r))) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  await User.findByIdAndUpdate(req.user.id, { payoutFrequencyDays });
  res.status(200).json({ success: true, message: 'Fréquence de paiement mise à jour' });
});
