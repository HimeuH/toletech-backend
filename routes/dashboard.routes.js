const express = require('express');
const router = express.Router();
const { farmerDashboard, ownerDashboard, adminDashboard } = require('../controllers/dashboard.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

router.get('/farmer', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), farmerDashboard);
router.get('/owner', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR'), ownerDashboard);
router.get('/admin', isAuthenticatedUser, authorizeRoles('ADMIN'), adminDashboard);

module.exports = router;
