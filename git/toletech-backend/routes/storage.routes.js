const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const authMiddleware = require('../middlewares/auth');

// router.post('/', authMiddleware, storageController.createStorage);
// router.get('/', storageController.getAllStorage);
// router.get('/search', storageController.searchStorage);


router.post('/', reservationController.createReservation);
router.get('/', reservationController.getAllReservations);
router.get('/search', reservationController.searchReservations);
router.get('/:id', reservationController.getReservationById);
router.put('/:id', reservationController.updateReservation);
router.delete('/:id', reservationController.deleteReservation);

module.exports = router;