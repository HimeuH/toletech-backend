const { validationResult } = require('express-validator');

// B1 — same uniform shape as middlewares/errors.js: { success:false, code, message, fields }
// `fields` maps each invalid field to its message so the front end can show
// inline errors without parsing express-validator's array format.
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fields = {};
    for (const e of errors.array()) {
      const field = e.path || e.param || '_';
      if (!fields[field]) fields[field] = e.msg;
    }
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Certains champs sont invalides.',
      fields,
    });
  }
  next();
};
