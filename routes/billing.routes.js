const express = require('express');
const { createBilling } = require('../controllers/billing.controller');
const { isAuthenticatedUser } = require('../middlewares/auth');
const { updateBillingStatus, getBillingById, getBillingsByStatus, getAllBillings } = require('../controllers/billing.controller');

const router = express.Router();

// Générer une facture
// router.post('/:reservationId/generate', isAuthenticatedUser, createBilling);
// router.post('/reservationId/generate', createBilling);
// router.put('/billingId/:status', updateBillingStatus )
// router.get('/billingId', getBillingById);
// router.get('/status', getBillingsByStatus);
// router.get('/', getAllBillings);


module.exports = router;