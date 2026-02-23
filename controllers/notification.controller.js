const Notification = require('../models/Notification');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const ErrorHandler = require('../utils/errorHandler');
const paginate = require('../utils/paginate');

// GET /api/v1/notifications — paginated, newest first
exports.getMyNotifications = catchAsyncErrors(async (req, res, next) => {
  const { page, limit } = req.query;
  const query = { user: req.user.id };

  if (req.query.isRead !== undefined) {
    query.isRead = req.query.isRead === 'true';
  }

  const result = await paginate(Notification, query, page, limit, '', { createdAt: -1 });
  res.status(200).json({ success: true, ...result });
});

// GET /api/v1/notifications/unread-count
exports.getUnreadCount = catchAsyncErrors(async (req, res, next) => {
  const count = await Notification.countDocuments({ user: req.user.id, isRead: false });
  res.status(200).json({ success: true, data: { count } });
});

// PUT /api/v1/notifications/:id/read — mark single notification as read
exports.markAsRead = catchAsyncErrors(async (req, res, next) => {
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user.id });
  if (!notification) return next(new ErrorHandler('Notification not found', 404));

  notification.isRead = true;
  await notification.save();

  res.status(200).json({ success: true, data: notification });
});

// PUT /api/v1/notifications/read-all — mark all as read for current user
exports.markAllAsRead = catchAsyncErrors(async (req, res, next) => {
  await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
  res.status(200).json({ success: true, message: 'All notifications marked as read' });
});
