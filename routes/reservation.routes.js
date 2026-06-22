const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservation.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createReservationRules } = require('../validators/reservation.validators');

router.post(
  '/',
  isAuthenticatedUser,
  authorizeRoles('AGRICULTEUR', 'AGENT', 'ADMIN'),
  createReservationRules,
  validate,
  reservationController.createReservation
);

// BE-015: owner dashboard — must come before /:id
router.get('/owner', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'), reservationController.getOwnerReservations);
router.get('/my', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), reservationController.getMyReservations);
router.get('/', isAuthenticatedUser, authorizeRoles('ADMIN', 'AGENT'), reservationController.getAllReservations);
router.get('/search', isAuthenticatedUser, reservationController.searchReservations);
// S3: transport missions — must be before /:id
router.get('/transport-missions', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), reservationController.getTransportMissions);
router.get('/:id', isAuthenticatedUser, reservationController.getReservationById);
router.put('/:id', isAuthenticatedUser, reservationController.updateReservation);
// BE-014: owner approve/reject
router.put('/:id/respond', isAuthenticatedUser, authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'), reservationController.respondToReservation);
// S3: transport actions
router.put('/:id/assign-transporter', isAuthenticatedUser, authorizeRoles('AGRICULTEUR', 'ADMIN'), reservationController.assignTransporter);
router.put('/:id/accept-transport', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), reservationController.acceptTransport);
router.put('/:id/reject-transport', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), reservationController.rejectTransport);
router.put('/:id/confirm-delivery', isAuthenticatedUser, authorizeRoles('TRANSPORTEUR'), reservationController.confirmDelivery);
// S8: admin adjust + dispute management
router.put('/:id/adjust', isAuthenticatedUser, authorizeRoles('ADMIN'), reservationController.adjustReservation);
router.put('/:id/dispute', isAuthenticatedUser, reservationController.openDispute);
router.put('/:id/resolve', isAuthenticatedUser, authorizeRoles('ADMIN'), reservationController.resolveDispute);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), reservationController.deleteReservation);

module.exports = router;
