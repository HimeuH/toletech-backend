const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// router.post('/', authMiddleware, reservationController.createReservation);
// router.get('/my', authMiddleware, reservationController.getUserReservations);

router.post('/', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), reservationController.createReservation);
router.get('/my', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), reservationController.getMyReservations);
router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), reservationController.getAllReservations);
router.get('/search', isAuthenticatedUser, reservationController.searchReservations);
router.get('/:id', isAuthenticatedUser, reservationController.getReservationById);
router.put('/:id', isAuthenticatedUser, reservationController.updateReservation);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), reservationController.deleteReservation);



module.exports = router;
