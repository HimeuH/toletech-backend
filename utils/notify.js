const Notification = require('../models/Notification');
const resolveNotificationLink = require('./notificationLink');
const { resolveNotificationCategory, resolveNotificationPriority, CRITICAL_TYPES } = require('./notificationMeta');

/**
 * Resolves a channel preference with category-level override, falling back to
 * the top-level default, then to `fallback` if the user has no prefs at all
 * (defensive — notifPrefs always has schema defaults in practice).
 */
function prefFor(user, category, channel, fallback) {
  const catPref = user?.notifPrefs?.categories?.[category]?.[channel];
  if (catPref !== undefined) return catPref;
  const topPref = user?.notifPrefs?.[channel];
  if (topPref !== undefined) return topPref;
  return fallback;
}

/**
 * Create an in-app notification and deliver it across channels.
 *
 * Push (B4) is attempted for **every** notification — push-first, gated only
 * by `notifPrefs.push`/category override and whether the user has any active
 * subscription (see utils/sendPush.js). SMS / WhatsApp stay call-site opt-in
 * exactly as before via `opts.sms`/`opts.whatsapp`; the only behaviour change
 * (B5) is that when push already succeeded and the type isn't critical, the
 * SMS is deferred to `smsScheduledAt` instead of sent immediately — a
 * background job (notificationFallbackJob.js) sends it only if the
 * notification is still unread once that time comes.
 *
 * @param {string} userId
 * @param {string} type
 * @param {string} title
 * @param {string} message    - in-app body (also used as SMS/push text if no override provided)
 * @param {object} [data]     - extra metadata stored on the notification doc
 * @param {object} [opts]
 * @param {boolean} [opts.sms]        - request SMS delivery
 * @param {boolean} [opts.whatsapp]   - request WhatsApp delivery
 * @param {boolean} [opts.push]       - force push on/off, bypassing notifPrefs (rarely needed)
 * @param {string}  [opts.smsText]    - override SMS text (use template short copy)
 * @param {string}  [opts.waText]     - override WhatsApp text (use template rich copy)
 * @param {string}  [opts.pushTitle]  - override push notification title
 * @param {string}  [opts.pushBody]   - override push notification body
 */
// Controlled by NOTIFY_CHANNEL env var: 'email' | 'sms' (default: 'sms')
module.exports = async (userId, type, title, message, data = {}, opts = {}) => {
  const { sms = false, whatsapp = false, smsText, waText, push: forcePush, pushTitle, pushBody } = opts;

  const link = resolveNotificationLink(type, data);
  const category = resolveNotificationCategory(type);
  const priority = resolveNotificationPriority(type);
  const notification = await Notification.create({
    user: userId,
    type,
    title,
    message,
    data,
    link,
    category,
    priority,
  });

  if (!sms && !whatsapp && forcePush === false) return notification;

  try {
    const User = require('../models/User');
    const user = await User.findById(userId).select('phone email notifPrefs');

    const notifyChannel = process.env.NOTIFY_CHANNEL || 'sms';
    let dirty = false;

    // ── Push — attempted for every notification (push-first strategy) ──
    const prefPush = forcePush !== undefined ? forcePush : prefFor(user, category, 'push', true);
    let pushSent = false;
    if (prefPush) {
      const sendPush = require('./sendPush');
      pushSent = await sendPush(userId, {
        title: pushTitle || title,
        body: pushBody || message,
        url: link,
        notificationId: notification._id.toString(),
        category,
      }).catch(err => {
        console.error('[notify Push]', err?.message || err);
        return false;
      });
      if (pushSent) {
        notification.pushSentAt = new Date();
        dirty = true;
      }
    }

    // ── SMS / WhatsApp — unchanged opt-in gate, B5 adds the push-first delay ──
    if (sms) {
      if (notifyChannel === 'email' && user?.email) {
        const sendEmail = require('./sendEmail');
        void sendEmail({ email: user.email, subject: title, message: smsText || message }).catch(err =>
          console.error('[notify Email]', err?.message || err)
        );
      } else {
        const prefSms = prefFor(user, category, 'sms', true);
        if (user?.phone && prefSms) {
          const fallbackMin = Number(process.env.NOTIFY_SMS_FALLBACK_MIN ?? 15);
          const shouldDefer = pushSent && !CRITICAL_TYPES.has(type) && fallbackMin > 0;
          if (shouldDefer) {
            notification.smsScheduledAt = new Date(Date.now() + fallbackMin * 60_000);
            dirty = true;
          } else {
            const sendSms = require('./sendSms');
            void sendSms(user.phone, smsText || message).catch(err =>
              console.error('[notify SMS]', err?.message || err)
            );
            notification.smsSentAt = new Date();
            dirty = true;
          }
        }
      }
    }

    if (whatsapp && notifyChannel !== 'email') {
      const prefWhatsApp = prefFor(user, category, 'whatsapp', false);
      if (user?.phone && prefWhatsApp) {
        const sendWhatsApp = require('./sendWhatsApp');
        void sendWhatsApp(user.phone, waText || smsText || message).catch(err =>
          console.error('[notify WA]', err?.message || err)
        );
      }
    }

    if (dirty) await notification.save();
  } catch (err) {
    console.error('[notify] Channel delivery error:', err?.message || err);
  }

  return notification;
};
