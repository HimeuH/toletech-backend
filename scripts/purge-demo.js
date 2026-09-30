/**
 * Removes every demo account (email @demo.toletech.sn) and everything linked
 * to it — including data created live during a demo on REAL storages (demo
 * farmer bookings, their billings, notifications, wallet credits).
 *
 * Dry run by default (counts only). Pass --apply to delete.
 *   MONGO_URI="mongodb+srv://.../toletech?..." node scripts/purge-demo.js
 *   MONGO_URI="mongodb+srv://.../toletech?..." node scripts/purge-demo.js --apply
 */
const mongoose = require('mongoose');
const { User, Storage, Reservation, Billing, Otp } = require('../models');
const CommissionConfig = require('../models/CommissionConfig');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const ProviderBalance = require('../models/ProviderBalance');
const PaymentIntent = require('../models/PaymentIntent');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const IdempotencyKey = require('../models/IdempotencyKey');
const { toStorageUnit } = require('../utils/units');
const { DEMO_EMAIL_REGEX, connectAndConfirm } = require('./_prodDb');

const apply = process.argv.includes('--apply');

// Notification.data is Mixed — ids may have been stored as string or ObjectId.
const bothForms = (ids) => [...ids, ...ids.map(String)];

const main = async () => {
  try {
    await connectAndConfirm(apply ? 'PURGE demo data (--apply)' : 'dry run (no writes)');

    const users = await User.find({ email: DEMO_EMAIL_REGEX }).select('email phone');
    if (!users.length) {
      console.log('No demo users found — nothing to purge.');
      return;
    }
    const userIds = users.map((u) => u._id);
    const idSet = new Set(userIds.map(String));

    const storages = await Storage.find({ owner: { $in: userIds } }).select('_id');
    const storageIds = storages.map((s) => s._id);
    const storageSet = new Set(storageIds.map(String));

    const reservations = await Reservation.find({
      $or: [{ user: { $in: userIds } }, { storage: { $in: storageIds } }]
    }).select('user storage status quantity quantityUnit');
    const resIds = reservations.map((r) => r._id);

    // A REAL farmer's booking that only uses the demo transporter can't be
    // deleted automatically — stop and let an admin cancel the transport first.
    const transportOnly = await Reservation.find({
      transporter: { $in: userIds },
      _id: { $nin: resIds }
    }).select('_id');
    if (transportOnly.length) {
      throw new Error(
        `Real reservation(s) use a demo transporter — cancel their transport in the admin first:\n  ${transportOnly.map((r) => r._id).join('\n  ')}`
      );
    }

    const realBookingsOnDemo = reservations.filter((r) => !idSet.has(String(r.user)));
    if (realBookingsOnDemo.length) {
      console.log(`⚠️  ${realBookingsOnDemo.length} reservation(s) by REAL users on demo storages will be deleted:`);
      realBookingsOnDemo.forEach((r) => console.log(`    ${r._id} (user ${r.user})`));
    }

    const billings = await Billing.find({
      $or: [{ reservation: { $in: resIds } }, { user: { $in: userIds } }, { storage: { $in: storageIds } }]
    }).select('_id');
    const billingIds = billings.map((b) => b._id);

    const demoWallets = await Wallet.find({ user: { $in: userIds } }).select('_id');
    const demoWalletIds = demoWallets.map((w) => w._id);

    // Credits a demo payment put into REAL wallets (e.g. a real owner paid
    // during the demo) — reversed before their transactions are deleted.
    const realCredits = await Transaction.find({
      wallet: { $nin: demoWalletIds },
      type: { $in: ['CREDIT', 'ESCROW_RELEASE'] },
      $or: [{ relatedBilling: { $in: billingIds } }, { relatedReservation: { $in: resIds } }]
    }).select('wallet amount');

    // Capacity a CONFIRMÉ demo booking locked on a REAL storage.
    const capacityReleases = [];
    for (const r of reservations) {
      if (r.status !== 'CONFIRMÉ' || !r.quantity || storageSet.has(String(r.storage))) continue;
      const storage = await Storage.findById(r.storage).select('capacityUnit');
      if (!storage) continue;
      const converted = toStorageUnit(r.quantity, r.quantityUnit, storage.capacityUnit) ?? r.quantity;
      capacityReleases.push({ storage: r.storage, converted });
    }

    const targets = [
      ['Transactions', Transaction, {
        $or: [
          { wallet: { $in: demoWalletIds } },
          { relatedBilling: { $in: billingIds } },
          { relatedReservation: { $in: resIds } }
        ]
      }],
      ['Wallets', Wallet, { _id: { $in: demoWalletIds } }],
      ['ProviderBalances', ProviderBalance, { provider: { $in: userIds } }],
      ['PaymentIntents', PaymentIntent, { billingId: { $in: billingIds } }],
      ['Billings', Billing, { _id: { $in: billingIds } }],
      ['Reviews', Review, {
        $or: [
          { reviewer: { $in: userIds } },
          { reservation: { $in: resIds } },
          { targetId: { $in: [...userIds, ...storageIds] } }
        ]
      }],
      ['Notifications', Notification, {
        $or: [
          { user: { $in: userIds } },
          { 'data.reservationId': { $in: bothForms(resIds) } },
          { 'data.billingId': { $in: bothForms(billingIds) } }
        ]
      }],
      ['PushSubscriptions', PushSubscription, { user: { $in: userIds } }],
      ['IdempotencyKeys', IdempotencyKey, { user: { $in: userIds } }],
      ['Otps', Otp, {
        $or: [
          { phone: { $in: users.map((u) => u.phone).filter(Boolean) } },
          { email: { $in: users.map((u) => u.email) } }
        ]
      }],
      ['CommissionConfigs', CommissionConfig, {
        $or: [{ partnerId: { $in: userIds } }, { storageId: { $in: storageIds } }]
      }],
      ['Reservations', Reservation, { _id: { $in: resIds } }],
      ['Storages', Storage, { _id: { $in: storageIds } }],
      ['Users', User, { _id: { $in: userIds } }]
    ];

    console.log(`\n${apply ? 'Deleting' : 'Would delete'}:`);
    for (const [label, model, filter] of targets) {
      const n = apply ? (await model.deleteMany(filter)).deletedCount : await model.countDocuments(filter);
      console.log(`  ${label.padEnd(18)} ${n}`);
    }

    // Only REAL wallets/storages are touched here; both lists were built before the deletes.
    console.log(`\n${apply ? 'Reverted' : 'Would revert'}:`);
    console.log(`  wallet credits     ${realCredits.length}`);
    console.log(`  storage capacity   ${capacityReleases.length}`);
    if (apply) {
      for (const tx of realCredits) {
        const w = await Wallet.findByIdAndUpdate(
          tx.wallet,
          { $inc: { balance: -tx.amount, totalEarned: -tx.amount } },
          { new: true, runValidators: false }
        );
        if (w && w.balance < 0) {
          console.log(`  ⚠️  wallet ${w._id} is now negative (${w.balance} XOF) — demo money was already paid out, fix manually`);
        }
      }
      for (const { storage, converted } of capacityReleases) {
        await Storage.findByIdAndUpdate(storage, [
          { $set: { reservedCapacity: { $max: [0, { $subtract: ['$reservedCapacity', converted] }] } } }
        ]);
      }
    }

    console.log(apply ? '\n✅  Demo data purged' : '\nDry run only — rerun with --apply to delete');
  } catch (error) {
    console.error('\n❌ ', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
