const User = require('../models/User');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');

// Create new user
exports.createUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.create(req.body);
  res.status(201).json({ success: true, data: user });
});

// Get all users
exports.getAllUsers = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: users, count: users.length });
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

// Search users by name or email
exports.searchUsers = catchAsyncErrors(async (req, res, next) => {
  const { query } = req.query;
  const users = await User.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ]
  });
  res.status(200).json({ success: true, data: users, count: users.length });
});
