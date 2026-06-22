const express = require('express');
const router = express.Router();
const { listTransporters, getTransporterProfile, updateAvailability, setPricing } = require('../controllers/transporter.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// Public-ish: authenticated users can browse transporters
router.get('/', isAuthenticatedUser, listTransporters);

// Transporteur-only actions — must come before /:id to avoid route conflict
router.put('/availability', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), updateAvailability);
router.put('/pricing', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), setPricing);

router.get('/:id', isAuthenticatedUser, getTransporterProfile);

module.exports = router;
