const { body } = require("express-validator");

exports.registerRules = [
  body("name").notEmpty().withMessage("Name is required").trim(),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("phone")
    .notEmpty()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
    )
    // Allowed countries (E.164): SN(+221, 9 digits), CI(+225, 10 digits), ML(+223, 8 digits), GN(+224, 9 digits)
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage("Invalid phone number"),
  body("roles")
    .isArray({ min: 1 })
    .withMessage("Invalid value")
    .custom((roles) => {
      const valid = ["AGRICULTEUR", "PROPRIETAIRE", "TRANSFORMATEUR", "TRANSPORTEUR"];
      if (!roles.every((r) => valid.includes(r))) throw new Error("Invalid role");
      return true;
    }),
  body("location").optional().trim(),
  body("exploitationType").optional().trim(),
  body("crops").optional().isArray().withMessage("crops must be an array"),
  body("companyName").optional().trim(),
  body("companyRegistration").optional().trim(),
  body("contactPerson").optional().trim(),
];

exports.createAgentRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone')
    .notEmpty()
    .customSanitizer((value) =>
      typeof value === 'string' ? value.replace(/[\s-]/g, '') : value
    )
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage('Invalid phone number'),
  body('assignedRegion').notEmpty().withMessage('assignedRegion is required').trim(),
  body('identificationNumber').optional().trim(),
];

// password is auto-generated — not accepted from client
exports.createUserRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone')
    .notEmpty()
    .customSanitizer((value) =>
      typeof value === 'string' ? value.replace(/[\s-]/g, '') : value
    )
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage('Invalid phone number'),
  body('roles')
    .isArray({ min: 1 })
    .withMessage('Role is required')
    .custom((roles) => {
      const valid = ['AGRICULTEUR', 'PROPRIETAIRE', 'TRANSFORMATEUR', 'AGENT', 'ADMIN'];
      if (!roles.every((r) => valid.includes(r))) throw new Error('Invalid role');
      return true;
    }),
  body('location').optional().trim(),
  // AGRICULTEUR
  body('exploitationType').optional().trim(),
  body('crops').optional().isArray().withMessage('crops must be an array'),
  // PROPRIETAIRE / TRANSFORMATEUR
  body('companyName').optional().trim(),
  body('companyRegistration').optional().trim(),
  body('contactPerson').optional().trim(),
  // AGENT
  body('assignedRegion').optional().trim(),
  body('identificationNumber').optional().trim(),
];

exports.loginRules = [
  body("password").notEmpty().withMessage("Password is required"),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Email or phone is required");
    }
    return true;
  }),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone")
    .optional()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
    )
    // Allowed countries (E.164): SN(+221, 9 digits), CI(+225, 10 digits), ML(+223, 8 digits), GN(+224, 9 digits)
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage("Invalid phone number"),
];
