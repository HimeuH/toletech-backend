const express = require('express');
const router = express.Router();
const { farmerDashboard, ownerDashboard, adminDashboard, adminSeries, transporterDashboard } = require('../controllers/dashboard.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// Kept temporarily during the two-repository staging rollout. The redesigned
// frontend uses GET /me/home; remove these after that deployment is verified.
router.get('/farmer', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), farmerDashboard);
router.get('/owner', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR'), ownerDashboard);
router.get('/admin', isAuthenticatedUser, authorizeRoles('ADMIN'), adminDashboard);
router.get('/admin/series', isAuthenticatedUser, authorizeRoles('ADMIN'), adminSeries); // B18
router.get('/transporter', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), transporterDashboard);

module.exports = router;
