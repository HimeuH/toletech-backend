const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storage.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// router.post('/', authMiddleware, storageController.createStorage);
// router.get('/', storageController.getAllStorage);
// router.get('/search', storageController.searchStorage);


router.post(
  '/',
  isAuthenticatedUser,
  authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'AGENT', 'ADMIN'),
  storageController.createStorage
);
router.get('/my', isAuthenticatedUser, storageController.getMyStorages);
router.get('/', storageController.getAllStorages);
router.get('/search', storageController.searchStorages);
router.get('/:id', storageController.getStorageById);
router.put(
  '/:id',
  isAuthenticatedUser,
  authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'AGENT', 'ADMIN'),
  storageController.updateStorage
);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), storageController.deleteStorage);

module.exports = router;
