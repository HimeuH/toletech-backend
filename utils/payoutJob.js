/**
 * payoutJob.js — Automated payout cron
 *
 * Runs daily at 08:00. For each wallet whose owner has a payoutFrequencyDays
 * configured, checks if enough days have passed since lastPayoutAt (or wallet
 * creation) and automatically creates a PAYOUT transaction if balance > 0.
 *
 * Register in server.js: require('./utils/payoutJob');
 */
const cron = require('node-cron');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const notify = require('./notify');
const templates = require('./notificationTemplates');

async function runPayoutJob() {
  console.log('[payoutJob] Running payout check…');
  const now = new Date();

  // Load all wallets with positive balance, populate owner's payout config
  const wallets = await Wallet.find({ balance: { $gt: 0 } }).populate('user', 'name payoutFrequencyDays roles');

  let processed = 0;

  for (const wallet of wallets) {
    const user = wallet.user;
    if (!user) continue;

    // Only process for PROPRIETAIRE, TRANSFORMATEUR, TRANSPORTEUR
    const payableRoles = ['PROPRIETAIRE', 'TRANSFORMATEUR', 'TRANSPORTEUR'];
    if (!user.roles?.some(r => payableRoles.includes(r))) continue;

    const freqDays = user.payoutFrequencyDays ?? 15;
    const reference = wallet.lastPayoutAt || wallet.createdAt;
    const daysSince = (now - new Date(reference)) / (1000 * 60 * 60 * 24);

    if (daysSince < freqDays) continue;

    const amount = wallet.balance;

    try {
      wallet.balance = 0;
      wallet.totalPaidOut += amount;
      wallet.lastPayoutAt = now;
      await wallet.save();

      await Transaction.create({
        wallet: wallet._id,
        type: 'PAYOUT',
        amount,
        description: `Virement automatique J+${freqDays} — ${now.toLocaleDateString('fr-FR')}`,
        status: 'COMPLETED',
        processedAt: now
      });

      processed++;
      console.log(`[payoutJob] Payout ${amount} XOF → ${user.name} (wallet ${wallet._id})`);

      // S7-BE-03: notify user via in-app + SMS + WhatsApp
      const tpl = templates.PAYOUT_PROCESSED({ amount, frequencyDays: freqDays });
      void notify(user._id, 'GENERAL', tpl.title, tpl.inApp, { walletId: wallet._id }, {
        sms: true,
        whatsapp: true,
        smsText: tpl.sms,
        waText: tpl.whatsapp,
      }).catch(err => console.error('[payoutJob] Notify failed:', err?.message));
    } catch (err) {
      console.error(`[payoutJob] Failed for wallet ${wallet._id}:`, err.message);
    }
  }

  console.log(`[payoutJob] Done. ${processed} payout(s) processed.`);
}

// Schedule: daily at 08:00 AM
cron.schedule('0 8 * * *', () => {
  runPayoutJob().catch(err => console.error('[payoutJob] Uncaught error:', err.message));
});

module.exports = { runPayoutJob };
