const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');

// Summary endpoint — must be before /:id to avoid conflict
router.get('/summary', isAuthenticatedUser, reviewController.getReviewSummary);

router.post('/', isAuthenticatedUser, authorizeRoles('AGRICULTEUR'), reviewController.createReview);
router.get('/', isAuthenticatedUser, reviewController.getReviews);
router.put('/:id/moderate', isAuthenticatedUser, authorizeRoles('ADMIN'), reviewController.moderateReview);
router.delete('/:id', isAuthenticatedUser, authorizeRoles('ADMIN'), reviewController.deleteReview);

module.exports = router;
