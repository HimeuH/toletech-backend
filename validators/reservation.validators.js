const { body } = require('express-validator');

exports.createReservationRules = [
  body('storage').notEmpty().withMessage('Storage ID is required').isMongoId().withMessage('Invalid storage ID'),
  body('reservedFrom').notEmpty().withMessage('reservedFrom is required').isISO8601().withMessage('reservedFrom must be a valid date'),
  body('reservedTo').notEmpty().withMessage('reservedTo is required').isISO8601().withMessage('reservedTo must be a valid date'),
  body('reservedFrom').custom((value, { req }) => {
    if (req.body.reservedTo && new Date(value) >= new Date(req.body.reservedTo)) {
      throw new Error('reservedFrom must be before reservedTo');
    }
    return true;
  }),
];
