const { body } = require('express-validator');

exports.createStorageRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('storageType')
    .isIn(['SILO', 'HANGAR', 'CHAMBRE_FROIDE'])
    .withMessage('storageType must be one of: SILO, HANGAR, CHAMBRE_FROIDE'),
  body('capacity').isFloat({ gt: 0 }).withMessage('Capacity must be greater than 0'),
  body('capacityUnit')
    .isIn(['M2', 'HA', 'L', 'M3', 'TONNES'])
    .withMessage('capacityUnit must be one of: M2, HA, L, M3, TONNES'),
  body('costPerKgPerDay')
    .isFloat({ min: 0 })
    .withMessage('costPerKgPerDay must be a non-negative number'),
  body('availableFrom').isISO8601().withMessage('availableFrom must be a valid date'),
  body('availableTo').isISO8601().withMessage('availableTo must be a valid date'),
  body('availableFrom').custom((value, { req }) => {
    if (req.body.availableTo && new Date(value) >= new Date(req.body.availableTo)) {
      throw new Error('availableFrom must be before availableTo');
    }
    return true;
  }),
  body('facilities').optional().isArray().withMessage('facilities must be an array'),
  body('gpsCoordinates.coordinates')
    .optional()
    .isArray({ min: 2, max: 2 })
    .withMessage('gpsCoordinates.coordinates must be [longitude, latitude]'),
];
