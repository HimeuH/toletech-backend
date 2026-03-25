const express = require('express');
const router = express.Router();
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const {
  initiateCheckout,
  handleWebhook,
  getPaymentHistory,
  getCommissionConfigs,
  createCommissionConfig,
  updateCommissionConfig
} = require('../controllers/payment.controller');

// Webhook — no auth, raw body is preserved by app.js middleware
router.post('/webhook/:provider', handleWebhook);

// Checkout — authenticated user initiates payment for their billing
router.post('/checkout', isAuthenticatedUser, initiateCheckout);

// History — user sees own payments, admin sees all
router.get('/history', isAuthenticatedUser, getPaymentHistory);

// Commission config — admin only
router
  .route('/commission-configs')
  .get(isAuthenticatedUser, authorizeRoles('ADMIN'), getCommissionConfigs)
  .post(isAuthenticatedUser, authorizeRoles('ADMIN'), createCommissionConfig);

router
  .route('/commission-configs/:id')
  .put(isAuthenticatedUser, authorizeRoles('ADMIN'), updateCommissionConfig);

module.exports = router;
