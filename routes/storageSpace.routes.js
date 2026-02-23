const express = require('express');
const router = express.Router({ mergeParams: true }); // needed to access :storageId from parent router
const { isAuthenticatedUser, authorizeRoles } = require('../middlewares/auth');
const {
  createSpace,
  getSpacesByStorage,
  updateSpace,
  deleteSpace
} = require('../controllers/storageSpace.controller');

// GET — public, no auth required
router.get('/', getSpacesByStorage);

// Mutating routes — owner roles + ADMIN
router.post('/',
  isAuthenticatedUser,
  authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'AGENT', 'ADMIN'),
  createSpace
);

router.put('/:id',
  isAuthenticatedUser,
  authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'),
  updateSpace
);

router.delete('/:id',
  isAuthenticatedUser,
  authorizeRoles('PROPRIETAIRE', 'TRANSFORMATEUR', 'ADMIN'),
  deleteSpace
);

module.exports = router;
