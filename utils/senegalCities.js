/**
 * senegalCities.js — Coordinate lookup for major Senegalese localities.
 * Used by the transport pricing estimator to compute approximate distances.
 *
 * Haversine gives straight-line km; we apply a 1.3 road factor to
 * approximate driving distance.
 */

const ROAD_FACTOR = 1.3;

const CITIES = {
  'dakar':           { lat: 14.7167, lng: -17.4677 },
  'pikine':          { lat: 14.7500, lng: -17.3900 },
  'guediawaye':      { lat: 14.7781, lng: -17.3931 },
  'rufisque':        { lat: 14.7156, lng: -17.2734 },
  'bargny':          { lat: 14.6966, lng: -17.2289 },
  'diamniadio':      { lat: 14.7270, lng: -17.1915 },
  'thies':           { lat: 14.7910, lng: -16.9359 },
  'mbour':           { lat: 14.3882, lng: -16.9655 },
  'tivaouane':       { lat: 14.9553, lng: -16.8214 },
  'diourbel':        { lat: 14.6553, lng: -16.2322 },
  'fatick':          { lat: 14.3394, lng: -16.4109 },
  'foundiougne':     { lat: 14.1333, lng: -16.4667 },
  'joal-fadiouth':   { lat: 14.1632, lng: -16.8495 },
  'louga':           { lat: 15.6190, lng: -16.2243 },
  'saint-louis':     { lat: 16.0179, lng: -16.4896 },
  'saint louis':     { lat: 16.0179, lng: -16.4896 },
  'richard toll':    { lat: 16.4628, lng: -15.6999 },
  'podor':           { lat: 16.6537, lng: -14.9588 },
  'linguere':        { lat: 15.3929, lng: -15.1154 },
  'touba':           { lat: 14.8500, lng: -15.8833 },
  'mbacke':          { lat: 14.7983, lng: -15.9081 },
  'kaolack':         { lat: 14.1652, lng: -16.0757 },
  'gossas':          { lat: 14.4833, lng: -16.0667 },
  'kaffrine':        { lat: 14.1060, lng: -15.5506 },
  'sokone':          { lat: 13.8833, lng: -16.3667 },
  'nioro du rip':    { lat: 13.7500, lng: -15.7833 },
  'tambacounda':     { lat: 13.7707, lng: -13.6673 },
  'kedougou':        { lat: 12.5559, lng: -12.1778 },
  'matam':           { lat: 15.6560, lng: -13.2554 },
  'ziguinchor':      { lat: 12.5521, lng: -16.2720 },
  'kolda':           { lat: 12.8987, lng: -14.9407 },
  'sedhiou':         { lat: 12.7081, lng: -15.5570 },
};

function normalize(name) {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

/**
 * Estimate driving distance in km between two city name strings.
 * Returns null if either city is not in the lookup table.
 */
function estimateDistanceKm(fromCity, toCity) {
  const a = CITIES[normalize(fromCity)];
  const b = CITIES[normalize(toCity)];
  if (!a || !b) return null;
  return Math.round(haversineKm(a, b) * ROAD_FACTOR);
}

/**
 * Look up a fixed route from a transporter's fixedRoutes array.
 * Tries both directions (A→B and B→A).
 */
function findFixedRoute(fixedRoutes, fromCity, toCity) {
  const from = normalize(fromCity);
  const to = normalize(toCity);
  return (
    fixedRoutes.find(r => {
      const rFrom = normalize(r.from);
      const rTo = normalize(r.to);
      return (rFrom === from && rTo === to) || (rFrom === to && rTo === from);
    }) || null
  );
}

/**
 * Compute a price estimate for a transporter given a from/to pair.
 *
 * Returns:
 *   { type: 'FIXED', price: Number, km: null }      — matched a fixed route
 *   { type: 'PER_KM', price: Number, km: Number }   — calculated from per-km rate
 *   { type: 'NONE', price: null, km: null }          — no estimate possible
 */
function computeEstimate(transportPricing, fromCity, toCity) {
  if (!transportPricing || !fromCity || !toCity) {
    return { type: 'NONE', price: null, km: null };
  }

  const { mode, perKmRate, fixedRoutes = [] } = transportPricing;

  // Fixed routes take priority
  if ((mode === 'FIXED_ROUTES' || mode === 'BOTH') && fixedRoutes.length) {
    const route = findFixedRoute(fixedRoutes, fromCity, toCity);
    if (route) return { type: 'FIXED', price: route.price, km: null };
  }

  // Fall back to per-km
  if (mode === 'PER_KM' || mode === 'BOTH') {
    const km = estimateDistanceKm(fromCity, toCity);
    if (km !== null && perKmRate) {
      return { type: 'PER_KM', price: Math.round(km * perKmRate), km };
    }
  }

  return { type: 'NONE', price: null, km: null };
}

module.exports = { estimateDistanceKm, findFixedRoute, computeEstimate };
