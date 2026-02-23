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

// BE-015: owner dashboard — must come before /:id
router.get('/owner', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'), reservationController.getOwnerReservations);
router.get('/my', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), reservationController.getMyReservations);
router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), reservationController.getAllReservations);
router.get('/search', isAuthenticatedUser, reservationController.searchReservations);
router.get('/:id', isAuthenticatedUser, reservationController.getReservationById);
router.put('/:id', isAuthenticatedUser, reservationController.updateReservation);
// BE-014: owner approve/reject
router.put('/:id/respond', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'), reservationController.respondToReservation);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), reservationController.deleteReservation);

module.exports = router;
