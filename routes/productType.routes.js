const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productType.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// Public
router.get('/', ctrl.list);

// Admin only
router.get('/all', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.listAll);
router.post('/seed', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.seed);
router.post('/', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.create);
router.put('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.update);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), ctrl.remove);

module.exports = router;
