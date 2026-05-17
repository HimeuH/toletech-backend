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
    transportRate: { type: Number, default: 0 }, // suggested price per trip (XOF)

    // Payout config (PROPRIETAIRE / TRANSPORTEUR)
    payoutFrequencyDays: { type: Number, default: 15 },

    // Account status
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    pendingPhone: String,

    // Notification channel preferences (S7)
    notifPrefs: {
      sms:      { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },

    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // Phone change flow (S5)
    phoneChangeToken: String,        // hashed intermediate token (identity verified)
    phoneChangeTokenExpiry: Date,
    phoneChangeEmailCode: String,    // hashed OTP when identity sent via email
    phoneChangeEmailExpiry: Date
  },
  { timestamps: true }
);

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
