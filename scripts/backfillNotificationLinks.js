/**
 * scripts/backfillNotificationLinks.js — B2 one-off migration
 *
 * Sets `link` on every existing Notification that doesn't have one yet,
 * using the same resolver notify.js now applies to new notifications.
 * Safe to re-run: only touches docs where link is still null/missing.
 *
 * Usage:
 *   node scripts/backfillNotificationLinks.js            # apply
 *   node scripts/backfillNotificationLinks.js --dry-run   # report only
 */
const dotenv = require('dotenv');
const connectDB = require('../utils/db');
const Notification = require('../models/Notification');
const resolveNotificationLink = require('../utils/notificationLink');

dotenv.config({ path: './config/config.env' });

const dryRun = process.argv.includes('--dry-run');

(async () => {
  await connectDB();

  const cursor = Notification.find({ $or: [{ link: null }, { link: { $exists: false } }] }).cursor();

  let scanned = 0;
  let updated = 0;
  let unresolved = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const link = resolveNotificationLink(doc.type, doc.data || {});
    if (!link) {
      unresolved += 1;
      continue;
    }
    if (!dryRun) {
      await Notification.updateOne({ _id: doc._id }, { $set: { link } });
    }
    updated += 1;
  }

  console.log(`[backfillNotificationLinks] scanned=${scanned} updated=${updated} unresolved=${unresolved} dryRun=${dryRun}`);
  process.exit(0);
})().catch((err) => {
  console.error('[backfillNotificationLinks] failed:', err);
  process.exit(1);
});
