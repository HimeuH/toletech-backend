const Notification = require('../models/Notification');

/**
 * Create an in-app notification and optionally send an SMS.
 *
 * @param {string} userId - Recipient user ID
 * @param {string} type   - Notification type enum value
 * @param {string} title  - Short notification title
 * @param {string} message - Notification body
 * @param {object} data   - Optional extra data (reservationId, storageId, …)
 * @param {object} opts
 * @param {boolean} opts.sms - Send SMS in addition to in-app notification
 */
module.exports = async (userId, type, title, message, data = {}, { sms = false } = {}) => {
  const notification = await Notification.create({ user: userId, type, title, message, data });

  if (sms) {
    try {
      const User = require('../models/User');
      const sendSms = require('./sendSms');
      const user = await User.findById(userId).select('phone');
      if (user && user.phone) {
        await sendSms(user.phone, message);
      }
    } catch (err) {
      console.error('SMS notification failed:', err.message);
    }
  }

  return notification;
};
