const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createReservationRules } = require('../validators/reservation.validators');

router.post(
  '/',
  isAuthenticatedUser,
  authorizeRoles('AGRICULTEUR', 'ADMIN'),
  createReservationRules,
  validate,
  reservationController.createReservation
);
router.get('/my', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), reservationController.getMyReservations);
router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), reservationController.getAllReservations);
router.get('/search', isAuthenticatedUser, reservationController.searchReservations);
router.get('/:id', isAuthenticatedUser, reservationController.getReservationById);
router.put('/:id', isAuthenticatedUser, reservationController.updateReservation);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), reservationController.deleteReservation);

module.exports = router;
