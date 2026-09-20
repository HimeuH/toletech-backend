const ErrorHandler = require('../utils/errorHandler');

// B1 — uniform error shape: { success:false, code, message(fr), fields? }
// `code` lets the front end branch (e.g. AUTH_EXPIRED → silent refresh, else
// show `message` as-is). Every message here is the final user-facing French text.
module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    const env = (process.env.NODE_ENV || '').toLowerCase();

    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;
    error.code = err.code || 'ERROR';
    error.fields = err.fields;

    // Wrong Mongoose Object ID Error
    if (err.name === 'CastError') {
        error = new ErrorHandler('Ressource introuvable.', 404, 'NOT_FOUND');
    }

    // Handling Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const fields = Object.fromEntries(
            Object.entries(err.errors).map(([field, e]) => [field, e.message])
        );
        error = new ErrorHandler('Certains champs sont invalides.', 400, 'VALIDATION_ERROR', fields);
    }

    // Handling Mongoose duplicate key errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const friendlyField = field === 'email' ? 'adresse email' : field === 'phone' ? 'numéro de téléphone' : field;
        error = new ErrorHandler(`Un compte existe déjà avec cette ${friendlyField}.`, 409, 'DUPLICATE_KEY', { [field]: `Cette ${friendlyField} est déjà utilisée.` });
    }

    // Handling wrong JWT error — 401 (not 400): the front distinguishes
    // "not logged in / bad token" from a validation error and can react
    // (e.g. redirect to login) without parsing the message.
    if (err.name === 'JsonWebTokenError') {
        error = new ErrorHandler('Session invalide. Veuillez vous reconnecter.', 401, 'AUTH_INVALID');
    }

    // Handling Expired JWT error — 401, distinct code so the front can try
    // a silent refresh (B8) before bouncing the user to login.
    if (err.name === 'TokenExpiredError') {
        error = new ErrorHandler('Votre session a expiré. Veuillez vous reconnecter.', 401, 'AUTH_EXPIRED');
    }

    if (env !== 'production') {
        console.log(err);
    }

    return res.status(error.statusCode || 500).json({
        success: false,
        code: error.code || 'ERROR',
        message: error.message || 'Une erreur est survenue. Veuillez réessayer.',
        ...(error.fields ? { fields: error.fields } : {}),
    });
}
