const express = require('express');
const router = express.Router();
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const {
  initiateCheckout,
  handleWebhook,
  redirectSuccess,
  redirectError,
  getPaymentHistory,
  getCommissionConfigs,
  createCommissionConfig,
  updateCommissionConfig,
  getProviders,
  toggleProvider
} = require('../controllers/payment.controller');

// Webhook — no auth, raw body is preserved by app.js middleware
router.post('/webhook/:provider', handleWebhook);

// Redirect proxy — Wave calls these HTTPS URLs, we forward browser to local frontend
router.get('/redirect/success', redirectSuccess);
router.get('/redirect/error', redirectError);

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

// Payment providers — read for all authenticated users, write for admin only
router.get('/providers', isAuthenticatedUser, getProviders);
router.put('/providers/:provider', isAuthenticatedUser, authorizeRoles('ADMIN'), toggleProvider);

module.exports = router;
