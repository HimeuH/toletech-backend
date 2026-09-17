/**
 * units.js — shared quantity/capacity unit helpers, extracted from
 * reservation.controller.js so storage.controller.js (B10 search "fits" /
 * B11 quote) can reuse the exact same conversion the reservation flow
 * already relies on for its capacity check, instead of a second copy that
 * could silently drift.
 */

// Convert a quantity to a target capacityUnit for comparison (best-effort).
function toStorageUnit(quantity, quantityUnit, capacityUnit) {
  if (!quantity || !quantityUnit || !capacityUnit) return null;
  if (quantityUnit === capacityUnit) return quantity;
  // KG ↔ TONNES
  if (quantityUnit === 'KG' && capacityUnit === 'TONNES') return quantity / 1000;
  if (quantityUnit === 'TONNES' && capacityUnit === 'KG') return quantity * 1000;
  // Cannot compare across incompatible units (e.g. TONNES vs M2) — skip check
  return null;
}

// Haversine distance in km between two [lng, lat] points.
function distanceKm([lng1, lat1], [lng2, lat2]) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { toStorageUnit, distanceKm };
