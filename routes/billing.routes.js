const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN'), billingController.getAllBillings);
router.get('/my', isAuthenticatedUser, billingController.getMyBillings);
router.get('/storage/:storageId', isAuthenticatedUser, billingController.getBillingsByStorage);
router.get('/:id', isAuthenticatedUser, billingController.getBillingById);
router.put('/:id/status', isAuthenticatedUser, authorizeRoles('ADMIN'), billingController.updateBillingStatus);

module.exports = router;
