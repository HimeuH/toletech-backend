/**
 * cloudinaryUrl.js — B13 (redesign plan §7): builds a transformed delivery
 * URL from a stored `public_id` instead of shipping the full-resolution
 * upload to every list screen (storage search cards were pulling the raw
 * upload — often several MB — for a 96px thumbnail).
 */
const cloudinary = require('../config/cloudinary');

function thumbnailUrl(publicId) {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width: 400, height: 300, crop: 'fill', fetch_format: 'auto', quality: 'auto' }],
  });
}

function imageUrl(publicId) {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width: 1200, fetch_format: 'auto', quality: 'auto' }],
  });
}

module.exports = { thumbnailUrl, imageUrl };
