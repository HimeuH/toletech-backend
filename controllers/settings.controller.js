const PlatformConfig = require('../models/PlatformConfig');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');

const DEFAULTS = [
  {
    key: 'PAYOUT_MIN_AMOUNT',
    label: 'Montant minimum de virement',
    description: 'Solde minimum (XOF) requis pour déclencher un virement automatique.',
    value: 1000,
    type: 'NUMBER'
  }
];

async function seedDefaults() {
  for (const d of DEFAULTS) {
    await PlatformConfig.findOneAndUpdate(
      { key: d.key },
      { $setOnInsert: d },
      { upsert: true, new: true }
    );
  }
}

// GET /api/v1/settings — admin only
exports.getConfigs = catchAsyncErrors(async (req, res) => {
  await seedDefaults();
  const configs = await PlatformConfig.find().sort({ key: 1 });
  res.status(200).json({ success: true, data: configs });
});

// PUT /api/v1/settings/:key — admin only
exports.updateConfig = catchAsyncErrors(async (req, res, next) => {
  const { value } = req.body;
  if (value === undefined) return next(new ErrorHandler('value is required', 400));

  const config = await PlatformConfig.findOneAndUpdate(
    { key: req.params.key },
    { value },
    { new: true, runValidators: true }
  );
  if (!config) return next(new ErrorHandler('Config not found', 404));
  res.status(200).json({ success: true, data: config });
});
