const mongoose = require('mongoose');

/**
 * PlatformConfig — generic key/value store for admin-configurable platform settings.
 * Seeds default values on first GET via the settings controller.
 */
const platformConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    type: { type: String, enum: ['NUMBER', 'STRING', 'BOOLEAN'], default: 'NUMBER' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformConfig', platformConfigSchema);
