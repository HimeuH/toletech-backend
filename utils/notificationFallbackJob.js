/**
 * notificationFallbackJob.js — B5 push-first SMS fallback (redesign plan §6.5).
 *
 * utils/notify.js defers the SMS for a non-critical, push-delivered
 * notification by setting `smsScheduledAt`. Every 5 minutes this job sends
 * that SMS for any notification whose time has come and that's still unread
 * — if the user already saw the push and acted on it, the SMS (and its cost)
 * is skipped entirely.
 *
 * Register in server.js: require('./utils/notificationFallbackJob');
 */
const cron = require('node-cron');
const Notification = require('../models/Notification');
const sendSms = require('./sendSms');

async function runNotificationFallbackJob() {
  const due = await Notification.find({
    smsScheduledAt: { $lte: new Date() },
    smsSentAt: null,
    isRead: false,
  })
    .limit(200)
    .populate('user', 'phone');

  if (!due.length) return;

  console.log(`[notificationFallbackJob] Sending ${due.length} deferred SMS`);

  for (const notification of due) {
    try {
      if (notification.user?.phone) {
        await sendSms(notification.user.phone, notification.message);
        notification.smsSentAt = new Date();
      }
    } catch (err) {
      console.error('[notificationFallbackJob] SMS failed:', err?.message || err);
    } finally {
      // Clear the schedule either way — a failed send here isn't retried,
      // matching the fire-and-forget behaviour of every other SMS call site.
      notification.smsScheduledAt = null;
      await notification.save().catch(() => {});
    }
  }
}

// Every 5 minutes
cron.schedule('*/5 * * * *', () => {
  runNotificationFallbackJob().catch(err => console.error('[notificationFallbackJob]', err.message));
});

module.exports = runNotificationFallbackJob;
