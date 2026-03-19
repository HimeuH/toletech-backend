const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// User routes
router.get('/me', isAuthenticatedUser, walletController.getMyWallet);
router.get('/transactions', isAuthenticatedUser, walletController.getMyTransactions);
router.put('/payout-frequency', isAuthenticatedUser, walletController.updatePayoutFrequency);

// Admin routes — must come before /:id style routes
router.get('/admin', isAuthenticatedUser, authorizeRoles('ADMIN'), walletController.getAllWallets);
router.get('/admin/summary', isAuthenticatedUser, authorizeRoles('ADMIN'), walletController.getAdminSummary);
router.post('/admin/payout', isAuthenticatedUser, authorizeRoles('ADMIN'), walletController.adminPayout);

module.exports = router;
