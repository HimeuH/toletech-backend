/**
 * statusCounts.js — B15 (redesign plan §7): per-status counts for segmented
 * list tabs with badges (Missions "Nouvelles · À effectuer · Terminées" etc,
 * §5.2 step 5). Always computed against the *base* query (before any status
 * filter the caller applied), so every tab's badge count is correct
 * regardless of which tab is currently selected.
 */
async function statusCounts(Model, baseQuery, statusField = 'status') {
  const rows = await Model.aggregate([
    { $match: baseQuery },
    { $group: { _id: `$${statusField}`, count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map(r => [r._id, r.count]));
}

module.exports = { statusCounts };
