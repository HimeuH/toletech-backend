const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    phone: { type: String, unique: true, sparse: true },
    roles: {
      type: [String],
      enum: ['AGRICULTEUR', 'PROPRIETAIRE', 'TRANSFORMATEUR', 'TRANSPORTEUR', 'AGENT', 'ADMIN'],
      default: ['AGRICULTEUR']
    },
    avatar: {
      public_id: String,
      url: String
    },
    // Shared profile field
    location: String,

    // AGRICULTEUR fields
    exploitationType: String,
    crops: [String],

    // PROPRIETAIRE / TRANSFORMATEUR fields
    companyName: String,
    companyRegistration: String,
    contactPerson: String,

    // AGENT fields
    assignedRegion: String,
    identificationNumber: String,

    // TRANSPORTEUR fields
    vehicleType: String,
    vehicleCapacity: Number,
    vehiclePlate: String,
    serviceZones: [String],
    isAvailableForTransport: { type: Boolean, default: true },
    transportPricing: {
      mode: { type: String, enum: ['FIXED_ROUTES', 'PER_KM', 'BOTH'] },
      perKmRate: { type: Number, default: 0 }, // XOF per km
      fixedRoutes: [
        {
          from:  { type: String, required: true },
          to:    { type: String, required: true },
          price: { type: Number, required: true } // XOF
        }
      ]
    },

    // Payout config (PROPRIETAIRE / TRANSPORTEUR)
    payoutFrequencyDays: { type: Number, default: 15 },

    // Account status
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    pendingPhone: String,

    // Notification channel preferences (S7; push + per-category overrides
    // added in B4, redesign plan §6.4). Category overrides are optional —
    // when a category has no explicit value for a channel, utils/notify.js
    // falls back to the top-level sms/whatsapp/push default below.
    notifPrefs: {
      sms:      { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      push:     { type: Boolean, default: true },
      categories: {
        reservations: { push: Boolean, sms: Boolean, whatsapp: Boolean },
        transport:    { push: Boolean, sms: Boolean, whatsapp: Boolean },
        paiements:    { push: Boolean, sms: Boolean, whatsapp: Boolean },
        compte:       { push: Boolean, sms: Boolean, whatsapp: Boolean },
      },
    },

    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // Phone change flow (S5)
    phoneChangeToken: String,        // hashed intermediate token (identity verified)
    phoneChangeTokenExpiry: Date,
    phoneChangeEmailCode: String,    // hashed OTP when identity sent via email
    phoneChangeEmailExpiry: Date,

    // B8 — rotating refresh tokens (one per signed-in device/browser), so the
    // short-lived access JWT (15 min) can be silently renewed without the
    // field worker being logged out. Only the SHA-256 hash is stored — the
    // raw token lives only in the httpOnly cookie — so a DB read never
    // exposes a usable credential. Revoking a session = removing its entry.
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          deviceLabel: String,       // e.g. parsed User-Agent, best-effort
          createdAt: { type: Date, default: Date.now },
          expiresAt: { type: Date, required: true },
        },
      ],
      default: [],
      select: false,
    },
  },
  { timestamps: true }
);

// B8 — refresh() and logout() both look users up by refreshTokens.tokenHash
// on every request that needs it; without this the lookup is a full scan.
userSchema.index({ 'refreshTokens.tokenHash': 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.getJwtToken = function () {
  return jwt.sign(
    { id: this._id, roles: this.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_TIME || '7d' }
  );
};

// B8 — short-lived access token (paired with a refresh token, see
// getRefreshToken below). Kept separate from getJwtToken so nothing that
// might still call the old method for a long-lived token breaks.
userSchema.methods.getAccessToken = function () {
  return jwt.sign(
    { id: this._id, roles: this.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_TIME || '15m' }
  );
};

// Generates a new opaque refresh token, pushes its hash onto this user
// (pruning expired ones), and returns the RAW token — only the raw value
// goes in the httpOnly cookie; only the hash is ever persisted. Caller must
// still `await this.save()`.
userSchema.methods.issueRefreshToken = function (deviceLabel) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const now = new Date();
  this.refreshTokens = (this.refreshTokens || []).filter((t) => t.expiresAt > now);
  this.refreshTokens.push({ tokenHash, deviceLabel, expiresAt });

  return raw;
};

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
  return resetToken;
};

// Convenience getter: primary role (first in array)
userSchema.virtual('role').get(function () {
  return this.roles && this.roles.length > 0 ? this.roles[0] : null;
});

module.exports = mongoose.model('User', userSchema);
