const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const authMiddleware = require('../middlewares/auth');

// router.post('/', authMiddleware, reservationController.createReservation);
// router.get('/my', authMiddleware, reservationController.getUserReservations);

router.post('/', reservationController.createReservation);
router.get('/', reservationController.getAllReservations);
router.get('/search', reservationController.searchReservations);
router.get('/:id', reservationController.getReservationById);
router.put('/:id', reservationController.updateReservation);
router.delete('/:id', reservationController.deleteReservation);


module.exports = router;
