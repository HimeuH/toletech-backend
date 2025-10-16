const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storage.controller');
const authMiddleware = require('../middlewares/auth');

// router.post('/', authMiddleware, storageController.createStorage);
// router.get('/', storageController.getAllStorage);
// router.get('/search', storageController.searchStorage);


router.post('/', storageController.createStorage);
router.get('/', storageController.getAllStorages);
router.get('/search', storageController.searchStorages);
router.get('/:id', storageController.getStorageById);
router.put('/:id', storageController.updateStorage);
router.delete('/:id', storageController.deleteStorage);

module.exports = router;