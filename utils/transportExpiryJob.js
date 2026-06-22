/**
 * transportExpiryJob.js — Auto-expire pending transport requests after 48h.
 *
 * If a transporter doesn't respond within 48h, the reservation's transport
 * fields are reset to NONE so the farmer can request a different transporter.
 *
 * Runs every hour.
 * Register in server.js: require('./utils/transportExpiryJob');
 */
const cron = require('node-cron');
const Reservation = require('../models/Reservation');
const notify = require('./notify');
const templates = require('./notificationTemplates');

async function runTransportExpiryJob() {
  const now = new Date();

  const expired = await Reservation.find({
    transportStatus: 'DEMANDÉ',
    transportExpiresAt: { $lte: now }
  });

  if (!expired.length) return;

  console.log(`[transportExpiryJob] Expiring ${expired.length} pending request(s)`);

  for (const reservation of expired) {
    reservation.transportStatus = 'NONE';
    reservation.transporter = undefined;
    reservation.needsTransport = false;
    reservation.proposedTransportFee = 0;
    reservation.transportRejectedAt = now;
    reservation.transportRejectionNote = 'Aucune réponse du transporteur dans les 48h';
    reservation.transportExpiresAt = undefined;
    await reservation.save();

    const tpl = templates.TRANSPORT_REJECTED({
      transporterName: 'Le transporteur',
      note: 'Aucune réponse dans les délais impartis (48h)'
    });

    await notify(
      reservation.user,
      'TRANSPORT_REJECTED',
      tpl.title,
      tpl.inApp,
      { reservationId: reservation._id },
      { sms: true, smsText: tpl.sms }
    ).catch(err => console.error('[transportExpiryJob] notify error:', err.message));
  }
}

// Run every hour
cron.schedule('0 * * * *', () => {
  runTransportExpiryJob().catch(err =>
    console.error('[transportExpiryJob]', err.message)
  );
});
