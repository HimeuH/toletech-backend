/**
 * pricing.js — the single storage-cost formula, shared by the search list's
 * `estimatedCost` (B10), the new quote endpoint (B11) and actual billing
 * generation (billing.controller.js#generateBilling), so a farmer is never
 * shown one number before submit and charged a different one after.
 *
 * FIX (found while building B11): generateBilling() computed
 * `days * storage.costPerKgPerDay` with no `quantity` factor at all, so
 * every reservation on a given storage was billed the same amount
 * regardless of how many kg were actually reserved — despite the field
 * being named "cost per KG per day". Only affects bills generated from here
 * on; existing Billing documents are left untouched (a backfill of already
 * issued/paid invoices is a separate decision, not made here).
 */
const { toKg } = require('./units');

function computeStorageAmount({ quantity, quantityUnit, costPerKgPerDay, days }) {
  const qtyKg = toKg(quantity, quantityUnit);
  return Math.round(qtyKg * days * (costPerKgPerDay || 0));
}

module.exports = { computeStorageAmount };
