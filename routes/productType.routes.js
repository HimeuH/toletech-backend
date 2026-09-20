const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productType.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const { publicLongCache } = require('../middlewares/cacheControl');

// Public — rarely changes, safe to cache (B3 / ngsw "performance" data group)
router.get('/', publicLongCache(86400), ctrl.list);

// Admin only
router.get('/all', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.listAll);
router.post('/seed', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.seed);
router.post('/', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.create);
router.put('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.update);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.remove);

module.exports = router;
