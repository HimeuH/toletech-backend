const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

router.post('/', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), userController.createUser);
router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), userController.getAllUsers);
router.get('/search', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), userController.searchUsers);
router.get('/:id', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), userController.getUserById);
router.put('/:id', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), userController.updateUser);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), userController.deleteUser);

module.exports = router;
