const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN'), billingController.getAllBillings);
router.get('/my', isAuthenticatedUser, billingController.getMyBillings);
router.get('/storage/:storageId', isAuthenticatedUser, billingController.getBillingsByStorage);
router.get('/by-reservation/:reservationId', isAuthenticatedUser, billingController.getBillingByReservation);
router.get('/:id', isAuthenticatedUser, billingController.getBillingById);
router.put('/:id/status', isAuthenticatedUser, authorizeRoles('ADMIN'), billingController.updateBillingStatus);
router.put('/:id/recalculate', isAuthenticatedUser, authorizeRoles('ADMIN'), billingController.recalculateBilling);

module.exports = router;
