const StorageSpace = require('../models/StorageSpace');
const Storage = require('../models/Storage');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');

// Helper: check if authenticated user owns the parent storage (or is ADMIN)
async function verifyStorageOwnership(storageId, user, next) {
  const storage = await Storage.findById(storageId);
  if (!storage) return next(new ErrorHandler('Storage not found', 404));
  if (user.role !== 'ADMIN' && storage.owner?.toString() !== user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }
  return storage;
}

// POST /api/v1/storages/:storageId/spaces
exports.createSpace = catchAsyncErrors(async (req, res, next) => {
  const storage = await verifyStorageOwnership(req.params.storageId, req.user, next);
  if (!storage) return;

  const space = await StorageSpace.create({ ...req.body, storage: req.params.storageId });
  res.status(201).json({ success: true, data: space });
});

// GET /api/v1/storages/:storageId/spaces
exports.getSpacesByStorage = catchAsyncErrors(async (req, res, next) => {
  const spaces = await StorageSpace.find({ storage: req.params.storageId });
  res.status(200).json({ success: true, data: spaces, count: spaces.length });
});

// PUT /api/v1/storages/:storageId/spaces/:id
exports.updateSpace = catchAsyncErrors(async (req, res, next) => {
  const storage = await verifyStorageOwnership(req.params.storageId, req.user, next);
  if (!storage) return;

  const space = await StorageSpace.findOneAndUpdate(
    { _id: req.params.id, storage: req.params.storageId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!space) return next(new ErrorHandler('Space not found', 404));

  res.status(200).json({ success: true, data: space });
});

// DELETE /api/v1/storages/:storageId/spaces/:id
exports.deleteSpace = catchAsyncErrors(async (req, res, next) => {
  const storage = await verifyStorageOwnership(req.params.storageId, req.user, next);
  if (!storage) return;

  const space = await StorageSpace.findOneAndDelete({ _id: req.params.id, storage: req.params.storageId });
  if (!space) return next(new ErrorHandler('Space not found', 404));

  res.status(200).json({ success: true, message: 'Space deleted successfully' });
});
