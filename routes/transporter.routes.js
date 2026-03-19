const express = require('express');
const router = express.Router();
const { listTransporters, getTransporterProfile, updateAvailability } = require('../controllers/transporter.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// Public-ish: authenticated users can browse transporters
router.get('/', isAuthenticatedUser, listTransporters);
router.get('/:id', isAuthenticatedUser, getTransporterProfile);

// Transporteur updates own availability
router.put('/availability', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), updateAvailability);

module.exports = router;
