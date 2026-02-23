const { body } = require('express-validator');

exports.registerRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone')
    .optional()
    .customSanitizer((value) =>
      typeof value === 'string' ? value.replace(/[\s-]/g, '') : value
    )
    // Allowed countries (E.164): SN(+221, 9 digits), CI(+225, 10 digits), ML(+223, 8 digits), GN(+224, 9 digits)
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage('Invalid phone number'),
  body('role').optional().isIn(['AGRICULTEUR', 'PROPRIETAIRE', 'TRANSFORMATEUR']).withMessage('Invalid role'),
  body('location').optional().trim(),
  body('exploitationType').optional().trim(),
  body('crops').optional().isArray().withMessage('crops must be an array'),
  body('companyName').optional().trim(),
  body('companyRegistration').optional().trim(),
  body('contactPerson').optional().trim(),
];

exports.loginRules = [
  body('password').notEmpty().withMessage('Password is required'),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error('Email or phone is required');
    }
    return true;
  }),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone')
    .optional()
    .customSanitizer((value) =>
      typeof value === 'string' ? value.replace(/[\s-]/g, '') : value
    )
    // Allowed countries (E.164): SN(+221, 9 digits), CI(+225, 10 digits), ML(+223, 8 digits), GN(+224, 9 digits)
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage('Invalid phone number'),
];
