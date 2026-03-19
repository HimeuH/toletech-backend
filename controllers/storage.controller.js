const Storage = require('../models/Storage');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const cloudinary = require('../config/cloudinary');
const paginate = require('../utils/paginate');

// Helper: upload files to Cloudinary and return { public_id, url } objects
async function uploadPhotos(files) {
  const uploads = Array.isArray(files) ? files : [files];
  const results = [];
  for (const file of uploads) {
    const result = await cloudinary.uploader.upload(file.tempFilePath || file.data, {
      folder: 'storages',
      resource_type: 'image'
    });
    results.push({ public_id: result.public_id, url: result.secure_url });
  }
  return results;
}

// Helper: delete photos from Cloudinary
async function destroyPhotos(photos) {
  for (const photo of photos) {
    if (photo.public_id) {
      await cloudinary.uploader.destroy(photo.public_id).catch(() => {});
    }
  }
}

// Create new storage
exports.createStorage = catchAsyncErrors(async (req, res, next) => {
  // Agent proxy: allow creating on behalf of an owner
  let ownerId = req.user.id;
  if (req.user.roles.includes('AGENT') && req.body.ownerId) {
    const User = require('../models/User');
    const owner = await User.findById(req.body.ownerId);
    if (!owner || !owner.roles.some(r => ['PROPRIETAIRE', 'TRANSFORMATEUR'].includes(r))) {
      return next(new ErrorHandler('Invalid owner specified', 400));
    }
    ownerId = req.body.ownerId;
  }

  const storageData = { ...req.body, owner: ownerId, createdBy: req.user.id };

  // Photo upload
  if (req.files && req.files.photos) {
    const files = req.files.photos;
    const fileList = Array.isArray(files) ? files : [files];
    if (fileList.length > 10) {
      return next(new ErrorHandler('Maximum 10 photos allowed', 400));
    }
    storageData.photos = await uploadPhotos(fileList);
  }

  const storage = await Storage.create(storageData);
  res.status(201).json({ success: true, data: storage });
});

// Get all storages (admin — no availability filter)
exports.getAllStorages = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await paginate(Storage, {}, page, limit, 'owner', { createdAt: -1 });
  res.status(200).json({ success: true, ...result });
});

// Get storages for current owner (all statuses)
exports.getMyStorages = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await paginate(Storage, { owner: req.user.id }, page, limit, '', { createdAt: -1 });
  res.status(200).json({ success: true, ...result });
});

// Get storage by ID
exports.getStorageById = catchAsyncErrors(async (req, res, next) => {
  const storage = await Storage.findById(req.params.id).populate('owner', 'name email phone');
  if (!storage) return next(new ErrorHandler('Storage not found', 404));
  res.status(200).json({ success: true, data: storage });
});

// Update storage
exports.updateStorage = catchAsyncErrors(async (req, res, next) => {
  let storage = await Storage.findById(req.params.id);
  if (!storage) return next(new ErrorHandler('Storage not found', 404));

  if (!req.user.roles.includes('ADMIN') && storage.owner?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  // Photo upload — append to existing photos, enforce 10-photo limit
  if (req.files && req.files.photos) {
    const files = req.files.photos;
    const fileList = Array.isArray(files) ? files : [files];
    const existingCount = storage.photos ? storage.photos.length : 0;
    if (existingCount + fileList.length > 10) {
      return next(new ErrorHandler(`Maximum 10 photos allowed. Storage already has ${existingCount}.`, 400));
    }
    const newPhotos = await uploadPhotos(fileList);
    req.body.photos = [...(storage.photos || []), ...newPhotos];
  }

  storage = await Storage.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.status(200).json({ success: true, data: storage });
});

// Delete storage (admin only — cleans up Cloudinary photos)
exports.deleteStorage = catchAsyncErrors(async (req, res, next) => {
  const storage = await Storage.findById(req.params.id);
  if (!storage) return next(new ErrorHandler('Storage not found', 404));

  if (!req.user.roles.includes('ADMIN') && storage.owner?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  if (storage.photos && storage.photos.length > 0) {
    await destroyPhotos(storage.photos);
  }

  await Storage.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Storage deleted successfully' });
});

// Delete a specific photo from a storage
exports.deleteStoragePhoto = catchAsyncErrors(async (req, res, next) => {
  const storage = await Storage.findById(req.params.id);
  if (!storage) return next(new ErrorHandler('Storage not found', 404));

  if (!req.user.roles.includes('ADMIN') && storage.owner?.toString() !== req.user.id) {
    return next(new ErrorHandler('Forbidden', 403));
  }

  const { publicId } = req.body;
  const photo = storage.photos.find(p => p.public_id === publicId);
  if (!photo) return next(new ErrorHandler('Photo not found', 404));

  await cloudinary.uploader.destroy(publicId).catch(() => {});
  storage.photos = storage.photos.filter(p => p.public_id !== publicId);
  await storage.save();

  res.status(200).json({ success: true, data: storage });
});

exports.getStorageByOwner = catchAsyncErrors(async (req, res, next) => {
  const storages = await Storage.find({ owner: req.params.id });
  res.status(200).json({ success: true, data: storages, count: storages.length });
});

// S2-BE-05: Admin adjust reserved capacity manually
exports.adjustCapacity = catchAsyncErrors(async (req, res, next) => {
  const { reservedCapacity } = req.body;

  if (reservedCapacity === undefined || reservedCapacity < 0) {
    return next(new ErrorHandler('reservedCapacity must be a non-negative number', 400));
  }

  const storage = await Storage.findById(req.params.id);
  if (!storage) return next(new ErrorHandler('Storage not found', 404));

  if (reservedCapacity > storage.capacity) {
    return next(new ErrorHandler(`reservedCapacity (${reservedCapacity}) cannot exceed total capacity (${storage.capacity})`, 400));
  }

  storage.reservedCapacity = reservedCapacity;
  await storage.save();

  res.status(200).json({ success: true, data: storage, message: 'Capacity adjusted successfully' });
});

exports.getStorageByStatus = catchAsyncErrors(async (req, res, next) => {
  const storages = await Storage.find({ isAvailable: req.params.status });
  res.status(200).json({ success: true, data: storages, count: storages.length });
});

// Search storages — geo-search, advanced filters, availability, pagination (BE-009, BE-010, BE-011, BE-034)
exports.searchStorages = catchAsyncErrors(async (req, res, next) => {
  const {
    location, productType, from, to,
    lat, lng, maxDistance,
    storageType, minPrice, maxPrice, facilities, minCapacity,
    page, limit
  } = req.query;

  const query = { isAvailable: true };

  // Geo-search (BE-009): takes priority over text location
  if (lat && lng) {
    const distanceMeters = (parseFloat(maxDistance) || 50) * 1000;
    query.gpsCoordinates = {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: distanceMeters
      }
    };
  } else if (location) {
    // Fallback text search on location string or address fields
    query.$or = [
      { location: { $regex: location, $options: 'i' } },
      { 'address.city': { $regex: location, $options: 'i' } },
      { 'address.region': { $regex: location, $options: 'i' } }
    ];
  }

  // Date availability
  if (from && to) {
    query.availableFrom = { $lte: new Date(from) };
    query.availableTo = { $gte: new Date(to) };
  }

  // Advanced filters (BE-010)
  if (storageType) query.storageType = storageType;
  if (productType) query.productType = productType;
  if (minPrice || maxPrice) {
    query.costPerKgPerDay = {};
    if (minPrice) query.costPerKgPerDay.$gte = Number(minPrice);
    if (maxPrice) query.costPerKgPerDay.$lte = Number(maxPrice);
  }
  if (facilities) {
    query.facilities = { $all: facilities.split(',').map(f => f.trim()) };
  }
  if (minCapacity) {
    query.capacity = { $gte: Number(minCapacity) };
  }

  // When using $near, sort is applied by MongoDB automatically — skip paginate's sort
  const useGeo = !!(lat && lng);
  if (useGeo) {
    // $near doesn't work with .countDocuments+skip; do a plain find
    const data = await Storage.find(query)
      .populate('owner', 'name email')
      .limit(parseInt(limit, 10) || 20);
    return res.status(200).json({ success: true, data, count: data.length });
  }

  const result = await paginate(Storage, query, page, limit, 'owner', { createdAt: -1 });
  res.status(200).json({ success: true, ...result });
});
