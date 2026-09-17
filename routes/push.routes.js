const express = require('express');
const router = express.Router();
const pushController = require('../controllers/push.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post('/subscriptions', isAuthenticatedUser, pushController.subscribe);
router.delete('/subscriptions', isAuthenticatedUser, pushController.unsubscribe);
router.post('/test', isAuthenticatedUser, authorizeRoles('ADMIN'), pushController.testPush);

module.exports = router;
