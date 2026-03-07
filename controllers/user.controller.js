const crypto = require('crypto');
const User = require('../models/User');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');
const sendSms = require('../utils/sendSms');

// Create new user (admin / agent) — auto-generates password
exports.createUser = catchAsyncErrors(async (req, res, next) => {
  const {
    name, email, phone, role,
    location, exploitationType, crops,
    companyName, companyRegistration, contactPerson,
    assignedRegion, identificationNumber
  } = req.body;

  const password = crypto.randomBytes(8).toString('hex');

  const user = await User.create({
    name, email, phone, role,
    location, exploitationType, crops,
    companyName, companyRegistration, contactPerson,
    assignedRegion, identificationNumber,
    password,
    isActive: true,
    isVerified: true,
    mustChangePassword: true,
  });

  if (phone) {
    void sendSms(
      phone,
      `Bienvenue sur ToleTech. Votre compte a été créé. Mot de passe temporaire: ${password}`
    ).catch((err) =>
      console.error('[createUser SMS] Failed to send credentials:', err?.message || err)
    );
  }

  const userData = user.toObject();
  delete userData.password;

  res.status(201).json({
    success: true,
    data: userData,
    temporaryPassword: password,
    message: 'User created. Credentials sent via SMS. Store the temporaryPassword — it will not be shown again.',
  });
});

// Get all users (admin) — paginated
exports.getAllUsers = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const result = await paginate(User, {}, page, limit);
  res.status(200).json({ success: true, ...result });
});

// Get user by ID
exports.getUserById = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorHandler('User not found', 404));
  res.status(200).json({ success: true, data: user });
});

// Update user
exports.updateUser = catchAsyncErrors(async (req, res, next) => {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return next(new ErrorHandler('User not found', 404));
  res.status(200).json({ success: true, data: updated });
});

// Delete user
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) return next(new ErrorHandler('User not found', 404));
  res.status(200).json({ success: true, message: 'User deleted' });
});

// Search users by name or email — paginated
exports.searchUsers = catchAsyncErrors(async (req, res, next) => {
  const { query, page, limit } = req.query;
  const filter = query
    ? {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      }
    : {};
  const result = await paginate(User, filter, page, limit);
  res.status(200).json({ success: true, ...result });
});
