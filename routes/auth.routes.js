const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { registerRules, loginRules } = require('../validators/auth.validators');

router.post('/register', registerRules, validate, authController.registerUser);
router.post('/login', loginRules, validate, authController.loginUser);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/password/forgot', authController.forgotPassword);
router.put('/password/reset/:token', authController.resetPassword);

router.get('/me', isAuthenticatedUser, authController.getUserProfile);
router.put('/password/update', isAuthenticatedUser, authController.updatePassword);
router.put('/me/update', isAuthenticatedUser, authController.updateProfile);
router.post('/verify-phone-change', isAuthenticatedUser, authController.verifyPhoneChange);
router.get('/logout', authController.logout);

router.get('/admin/users', isAuthenticatedUser, authorizeRoles('ADMIN'), authController.allUsers);
router.get('/admin/user/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), authController.getUserDetails);
router.put('/admin/user/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), authController.updateUser);
router.delete('/admin/user/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), authController.deleteUser);
router.post('/admin/agents', isAuthenticatedUser, authorizeRoles('ADMIN'), authController.createAgent);

module.exports = router;
