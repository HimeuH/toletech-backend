const { body } = require("express-validator");

exports.registerRules = [
  body("name").notEmpty().withMessage("Le nom est requis").trim(),
  body("email")
    .isEmail()
    .withMessage("Adresse email invalide")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Le mot de passe doit contenir au moins 6 caractères"),
  body("phone")
    .notEmpty()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
    )
    // Allowed countries (E.164): SN(+221, 9 digits), CI(+225, 10 digits), ML(+223, 8 digits), GN(+224, 9 digits)
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage("Numéro de téléphone invalide"),
  body("roles")
    .isArray({ min: 1 })
    .withMessage("Veuillez sélectionner au moins un rôle")
    .custom((roles) => {
      const valid = ["AGRICULTEUR", "PROPRIETAIRE", "TRANSFORMATEUR", "TRANSPORTEUR"];
      if (!roles.every((r) => valid.includes(r))) throw new Error("Rôle invalide");
      return true;
    }),
  body("location").optional().trim(),
  body("exploitationType").optional().trim(),
  body("crops").optional().isArray().withMessage("crops doit être un tableau"),
  body("companyName").optional().trim(),
  body("companyRegistration").optional().trim(),
  body("contactPerson").optional().trim(),
];

exports.createAgentRules = [
  body('name').notEmpty().withMessage('Le nom est requis').trim(),
  body('email').isEmail().withMessage('Adresse email invalide').normalizeEmail(),
  body('phone')
    .notEmpty()
    .customSanitizer((value) =>
      typeof value === 'string' ? value.replace(/[\s-]/g, '') : value
    )
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage('Numéro de téléphone invalide'),
  body('assignedRegion').notEmpty().withMessage('La région assignée est requise').trim(),
  body('identificationNumber').optional().trim(),
];

// password is auto-generated — not accepted from client
exports.createUserRules = [
  body('name').notEmpty().withMessage('Le nom est requis').trim(),
  body('email').isEmail().withMessage('Adresse email invalide').normalizeEmail(),
  body('phone')
    .notEmpty()
    .customSanitizer((value) =>
      typeof value === 'string' ? value.replace(/[\s-]/g, '') : value
    )
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage('Numéro de téléphone invalide'),
  body('roles')
    .isArray({ min: 1 })
    .withMessage('Veuillez sélectionner au moins un rôle')
    .custom((roles) => {
      const valid = ['AGRICULTEUR', 'PROPRIETAIRE', 'TRANSFORMATEUR', 'AGENT', 'ADMIN'];
      if (!roles.every((r) => valid.includes(r))) throw new Error('Rôle invalide');
      return true;
    }),
  body('location').optional().trim(),
  // AGRICULTEUR
  body('exploitationType').optional().trim(),
  body('crops').optional().isArray().withMessage('crops doit être un tableau'),
  // PROPRIETAIRE / TRANSFORMATEUR
  body('companyName').optional().trim(),
  body('companyRegistration').optional().trim(),
  body('contactPerson').optional().trim(),
  // AGENT
  body('assignedRegion').optional().trim(),
  body('identificationNumber').optional().trim(),
];

exports.loginRules = [
  body("password").notEmpty().withMessage("Le mot de passe est requis"),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("L'email ou le téléphone est requis");
    }
    return true;
  }),
  body("email").optional().isEmail().withMessage("Adresse email invalide"),
  body("phone")
    .optional()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/[\s-]/g, "") : value,
    )
    // Allowed countries (E.164): SN(+221, 9 digits), CI(+225, 10 digits), ML(+223, 8 digits), GN(+224, 9 digits)
    .matches(/^(?:\+|00)?(?:221\d{9}|225\d{10}|223\d{8}|224\d{9})$/)
    .withMessage("Numéro de téléphone invalide"),
];
