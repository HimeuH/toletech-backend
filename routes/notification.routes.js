const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { isAuthenticatedUser } = require('../middlewares/auth');

router.get('/', isAuthenticatedUser, notificationController.getMyNotifications);
router.get('/unread-count', isAuthenticatedUser, notificationController.getUnreadCount);
// read-all before /:id to avoid param conflict
router.put('/read-all', isAuthenticatedUser, notificationController.markAllAsRead);
router.put('/:id/read', isAuthenticatedUser, notificationController.markAsRead);

module.exports = router;
