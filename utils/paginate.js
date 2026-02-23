/**
 * Reusable pagination helper.
 * @param {Model} model - Mongoose model
 * @param {Object} query - Mongoose query filter
 * @param {number|string} page - Current page (default 1)
 * @param {number|string} limit - Items per page (default 20)
 * @param {string|Object} populate - Populate path(s) passed to .populate()
 * @param {Object} sort - Mongoose sort object (default { createdAt: -1 })
 */
module.exports = async (model, query, page = 1, limit = 20, populate = '', sort = { createdAt: -1 }) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 20;
  const skip = (page - 1) * limit;

  const totalCount = await model.countDocuments(query);
  let results = model.find(query).sort(sort).skip(skip).limit(limit);
  if (populate) results = results.populate(populate);
  const data = await results;

  return {
    data,
    count: data.length,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
};
