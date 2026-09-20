/**
 * pricing.js — the single storage-cost formula, shared by the search list's
 * `estimatedCost` (B10), the quote endpoint (B11) and actual billing
 * generation (billing.controller.js#generateBilling), so a farmer is never
 * shown one number before submit and charged a different one after.
 *
 * `costPerKgPerDay` is a misleading field name — despite what it says, it's
 * actually "cost per ONE UNIT OF THE STORAGE'S OWN capacityUnit, per day".
 * Confirmed from spaces-create.html's label ("Tarif par {capacityUnit} par
 * jour") and the pre-existing homepage estimate (`days * rawQuantity *
 * tarifJournalier`, no unit conversion at all). A storage with
 * capacityUnit=TONNES and costPerKgPerDay=12 means 12 FCFA per TONNE per
 * day, not per kg.
 *
 * FIX #1 (found while building B11): generateBilling() computed
 * `days * storage.costPerKgPerDay` with no `quantity` factor at all — every
 * reservation on a given storage was billed the same amount regardless of
 * how much was actually reserved.
 *
 * FIX #2 (found by the user testing FIX #1 in the running app): the first
 * pass over-corrected by converting quantity to kg before multiplying,
 * which inflated the price 1000x for any TONNES reservation (2 t became
 * "2000 kg x rate", when the rate is per tonne, not per kg, for a
 * TONNES-capacity storage). Converts to the storage's own capacityUnit
 * instead (same conversion `fits` already uses), so a same-unit
 * reservation (the common case) is a pure passthrough with no conversion
 * factor at all.
 *
 * Only affects bills generated from here on; existing Billing documents are
 * left untouched (backfilling already-issued/paid invoices is a separate
 * decision, not made here).
 */
const { toStorageUnit } = require('./units');

function computeStorageAmount({ quantity, quantityUnit, capacityUnit, costPerKgPerDay, days }) {
  const converted = toStorageUnit(quantity, quantityUnit, capacityUnit);
  // Incompatible/unrecognized unit pair (e.g. KG vs M2) — no conversion path
  // exists, so fall back to the raw number, matching what the app already
  // did everywhere before this file existed rather than blocking the price.
  const qty = converted !== null ? converted : quantity || 0;
  return Math.round(qty * days * (costPerKgPerDay || 0));
}

module.exports = { computeStorageAmount };
