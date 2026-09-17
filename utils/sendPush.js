const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:contact@toletech.sn', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/**
 * sendPush(userId, payload) — delivers a Web Push notification to every
 * subscription the user has (phone + desktop, say), building the ngsw
 * payload shape (redesign plan §6.4/§6.5) so the Angular service worker's
 * default handler can render it and route the click with no custom SW code.
 *
 * Returns true if at least one subscription accepted the push.
 *
 * @param {string} userId
 * @param {object} payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {string|null} [payload.url]            deep link, opened on click
 * @param {string} [payload.notificationId]
 * @param {string} [payload.category]
 * @param {string} [payload.tag]                  collapses repeat pushes of the same kind
 */
module.exports = async function sendPush(userId, payload) {
  if (!ensureConfigured()) return false;

  const subscriptions = await PushSubscription.find({ user: userId });
  if (!subscriptions.length) return false;

  const ngswPayload = JSON.stringify({
    notification: {
      title: payload.title,
      body: payload.body,
      // No dedicated small monochrome "badge" icon yet (redesign plan §6.1) —
      // reuse the 96x96 app icon until one's designed.
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: payload.tag || payload.category || 'toletech',
      renotify: true,
      timestamp: Date.now(),
      data: {
        url: payload.url || '/dashboard',
        notificationId: payload.notificationId,
        onActionClick: {
          default: { operation: 'navigateLastFocusedOrOpen', url: payload.url || '/dashboard' },
        },
      },
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          ngswPayload,
          { TTL: 86400, urgency: 'normal' },
        )
        .then(async () => {
          sub.lastSuccessAt = new Date();
          sub.failureCount = 0;
          await sub.save();
          return true;
        })
        .catch(async err => {
          const statusCode = err?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is dead (browser data cleared, uninstalled…) — drop it.
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            sub.failureCount += 1;
            await sub.save().catch(() => {});
          }
          return false;
        }),
    ),
  );

  return results.some(r => r.status === 'fulfilled' && r.value === true);
};
