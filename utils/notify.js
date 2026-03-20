const Notification = require('../models/Notification');

/**
 * Create an in-app notification and optionally deliver via SMS / WhatsApp.
 *
 * Channel delivery is gated by the user's notifPrefs:
 *   - sms      : delivered only if user.notifPrefs.sms !== false  (default true)
 *   - whatsapp : delivered only if user.notifPrefs.whatsapp === true (default false)
 *
 * Callers can still force a channel by passing { sms: true } / { whatsapp: true }.
 * Forced channels bypass the preference check (useful for critical OTP/payout alerts).
 *
 * @param {string} userId
 * @param {string} type
 * @param {string} title
 * @param {string} message    - in-app body (also used as SMS text if no smsText provided)
 * @param {object} [data]     - extra metadata stored on the notification doc
 * @param {object} [opts]
 * @param {boolean} [opts.sms]        - request SMS delivery
 * @param {boolean} [opts.whatsapp]   - request WhatsApp delivery
 * @param {string}  [opts.smsText]    - override SMS text (use template short copy)
 * @param {string}  [opts.waText]     - override WhatsApp text (use template rich copy)
 */
module.exports = async (userId, type, title, message, data = {}, opts = {}) => {
  const { sms = false, whatsapp = false, smsText, waText } = opts;

  const notification = await Notification.create({ user: userId, type, title, message, data });

  if (!sms && !whatsapp) return notification;

  try {
    const User = require('../models/User');
    const user = await User.findById(userId).select('phone notifPrefs');

    if (!user?.phone) return notification;

    const prefSms      = user.notifPrefs?.sms !== false;       // default true
    const prefWhatsApp = user.notifPrefs?.whatsapp === true;   // default false

    if (sms && prefSms) {
      const sendSms = require('./sendSms');
      void sendSms(user.phone, smsText || message).catch(err =>
        console.error('[notify SMS]', err?.message || err)
      );
    }

    if (whatsapp && prefWhatsApp) {
      const sendWhatsApp = require('./sendWhatsApp');
      void sendWhatsApp(user.phone, waText || smsText || message).catch(err =>
        console.error('[notify WA]', err?.message || err)
      );
    }
  } catch (err) {
    console.error('[notify] Channel delivery error:', err?.message || err);
  }

  return notification;
};
