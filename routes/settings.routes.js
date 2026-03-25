const express = require('express');
const router = express.Router();
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const { getConfigs, updateConfig } = require('../controllers/settings.controller');

router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN'), getConfigs);
router.put('/:key', isAuthenticatedUser, authorizeRoles('ADMIN'), updateConfig);

module.exports = router;
