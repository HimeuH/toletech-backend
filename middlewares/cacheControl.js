/**
 * cacheControl.js — B3: explicit Cache-Control per route.
 *
 * Default (set in app.js for the whole /api/v1 tree) is `no-store`, since
 * most endpoints return per-user data. Reference/lookup endpoints that
 * rarely change (product types, public settings, cities…) opt into a long
 * `public` cache so the front end's service worker (Phase 0/6, ngsw
 * `dataGroups` "performance" strategy) and any intermediate proxy can
 * actually cache them instead of re-fetching on every 3G page load.
 */
const noStore = (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
};

const publicLongCache = (maxAgeSeconds = 86400) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
  next();
};

module.exports = { noStore, publicLongCache };
