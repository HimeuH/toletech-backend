const express = require('express');
const router = express.Router();
const { adminDashboard, adminSeries } = require('../controllers/dashboard.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// B20 — /farmer, /owner, /transporter removed: superseded by GET /me/home (Phase 2).
router.get('/admin', isAuthenticatedUser, authorizeRoles('ADMIN'), adminDashboard);
router.get('/admin/series', isAuthenticatedUser, authorizeRoles('ADMIN'), adminSeries); // B18

module.exports = router;
