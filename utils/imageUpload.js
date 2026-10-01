// Image uploads to Cloudinary — shared by storage photos, user avatars and
// delivery proofs. The `limit` transformation resizes on upload (max 1600px,
// auto quality), so a full-size phone photo is never stored or delivered.
const cloudinary = require('../config/cloudinary');
const ErrorHandler = require('./errorHandler');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Phone photos arrive full size (no browser-side shrinking) — 10 MB is also
// Cloudinary's free-plan per-image limit.
const MAX_BYTES = 10 * 1024 * 1024;

// Returns an ErrorHandler for the first invalid file, null if all are valid.
function validateImages(files) {
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return new ErrorHandler('Format non accepté. Utilisez une image JPG, PNG ou WebP.', 400, 'INVALID_FILE_TYPE');
    }
    if (file.size > MAX_BYTES) {
      return new ErrorHandler('Image trop lourde (10 Mo maximum).', 400, 'FILE_TOO_LARGE');
    }
  }
  return null;
}

async function uploadImage(file, { folder, maxSize = 1600 }) {
  const result = await cloudinary.uploader.upload(file.tempFilePath || file.data, {
    folder,
    resource_type: 'image',
    transformation: [{ width: maxSize, height: maxSize, crop: 'limit', quality: 'auto' }],
  });
  return { public_id: result.public_id, url: result.secure_url };
}

async function destroyImage(publicId) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId).catch(() => {});
}

module.exports = { validateImages, uploadImage, destroyImage, MAX_BYTES };
