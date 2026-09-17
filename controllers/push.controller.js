const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const PushSubscription = require('../models/PushSubscription');
const sendPush = require('../utils/sendPush');

// GET /api/v1/push/vapid-public-key — the front needs this to call
// SwPush.requestSubscription({ serverPublicKey }).
exports.getVapidPublicKey = catchAsyncErrors(async (req, res) => {
  res.status(200).json({ success: true, data: { publicKey: process.env.VAPID_PUBLIC_KEY || null } });
});

// POST /api/v1/push/subscriptions — upsert by endpoint, so re-subscribing
// the same browser (e.g. after a key rotation) just refreshes it.
exports.subscribe = catchAsyncErrors(async (req, res, next) => {
  const { endpoint, keys, userAgent, platform } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return next(new ErrorHandler('Abonnement push invalide', 400, 'VALIDATION_ERROR'));
  }

  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      user: req.user.id,
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      userAgent: userAgent || req.headers['user-agent'] || null,
      platform: platform || null,
      failureCount: 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.status(201).json({ success: true, data: subscription });
});

// DELETE /api/v1/push/subscriptions — unsubscribe one device (logout on a
// shared phone, or the user turning push off). Scoped to the caller's own
// subscriptions so one account can't unsubscribe another's device.
exports.unsubscribe = catchAsyncErrors(async (req, res, next) => {
  const { endpoint } = req.body;
  if (!endpoint) return next(new ErrorHandler('endpoint requis', 400, 'VALIDATION_ERROR'));

  await PushSubscription.deleteOne({ endpoint, user: req.user.id });
  res.status(200).json({ success: true, data: null });
});

// POST /api/v1/push/test — dev/admin only, sends a test push to yourself.
exports.testPush = catchAsyncErrors(async (req, res) => {
  const sent = await sendPush(req.user.id, {
    title: 'Test ToleTech',
    body: 'Ceci est une notification push de test.',
    url: '/dashboard',
    category: 'compte',
  });
  res.status(200).json({ success: true, data: { sent } });
});
