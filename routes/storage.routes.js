const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storage.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createStorageRules } = require('../validators/storage.validators');

router.post(
  '/',
  isAuthenticatedUser,
  authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'AGENT', 'ADMIN'),
  createStorageRules,
  validate,
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
router.delete('/:id', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'), storageController.deleteStorage);
router.delete('/:id/photos', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'), storageController.deleteStoragePhoto);
// S2-BE-05: Admin adjust reserved capacity
router.put('/:id/adjust-capacity', isAuthenticatedUser, authorizeRoles('ADMIN'), storageController.adjustCapacity);

module.exports = router;
