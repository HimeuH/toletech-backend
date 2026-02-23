const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

router.get('/users', isAuthenticatedUser, authorizeRoles('AGENT'), agentController.getRegionUsers);

module.exports = router;
