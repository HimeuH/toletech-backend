/**
 * scripts/migrateApprovedToConfirmed.js — one-off migration
 *
 * Owner approval now confirms a reservation directly (EN_ATTENTE → CONFIRMÉ),
 * so APPROUVÉ is no longer set. Moves every existing APPROUVÉ reservation to
 * CONFIRMÉ and runs the same confirmation effects (capacity lock, billing,
 * pre-selected transport request). Reservations that no longer fit in their
 * storage are skipped and listed — resolve them manually.
 * Safe to re-run: only touches docs still in APPROUVÉ.
 *
 * Usage:
 *   node scripts/migrateApprovedToConfirmed.js            # apply
 *   node scripts/migrateApprovedToConfirmed.js --dry-run   # report only
 */
const dotenv = require('dotenv');
const connectDB = require('../utils/db');
const Reservation = require('../models/Reservation');
const { checkCapacityForConfirm, applyConfirmationEffects } = require('../utils/reservationLifecycle');

dotenv.config({ path: './config/config.env' });

const dryRun = process.argv.includes('--dry-run');

(async () => {
  await connectDB();

  const cursor = Reservation.find({ status: 'APPROUVÉ' }).cursor();

  let scanned = 0;
  let migrated = 0;
  const skipped = [];

  for await (const reservation of cursor) {
    scanned += 1;
    const capacityError = await checkCapacityForConfirm(reservation);
    if (capacityError) {
      skipped.push(`${reservation._id}: ${capacityError}`);
      continue;
    }
    if (!dryRun) {
      reservation.status = 'CONFIRMÉ';
      reservation.statusHistory.push({
        status: 'CONFIRMÉ',
        changedBy: reservation.user,
        message: 'Migration : approbation propriétaire = confirmation'
      });
      await reservation.save();
      await applyConfirmationEffects(reservation);
    }
    migrated += 1;
  }

  console.log(`[migrateApprovedToConfirmed] scanned=${scanned} migrated=${migrated} skipped=${skipped.length} dryRun=${dryRun}`);
  skipped.forEach(line => console.log(`  skipped ${line}`));
  process.exit(0);
})().catch((err) => {
  console.error('[migrateApprovedToConfirmed] failed:', err);
  process.exit(1);
});
