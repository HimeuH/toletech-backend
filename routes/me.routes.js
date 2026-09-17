const express = require('express');
const router = express.Router();
const meController = require('../controllers/me.controller');
const { isAuthenticatedUser } = require('../middlewares/auth');

router.get('/home', isAuthenticatedUser, meController.getHome);
router.get('/todo', isAuthenticatedUser, meController.getTodo);

module.exports = router;
