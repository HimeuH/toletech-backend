const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const { searchCities, nearestCity } = require('../utils/senegalCities');

// GET /api/v1/cities?q=dak — B19 (redesign plan §7): pickup-location
// autocomplete over the 33+ known Senegalese cities.
exports.listCities = catchAsyncErrors(async (req, res) => {
  const data = searchCities(req.query.q);
  res.status(200).json({ success: true, data });
});

// GET /api/v1/cities/nearest?lat=&lng= — "Ma position" GPS reverse lookup.
exports.getNearestCity = catchAsyncErrors(async (req, res, next) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return next(new ErrorHandler('lat et lng sont requis', 400, 'VALIDATION_ERROR'));
  }
  res.status(200).json({ success: true, data: nearestCity(lat, lng) });
});
