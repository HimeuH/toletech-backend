const ErrorHandler = require('../utils/errorHandler');


module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    const env = (process.env.NODE_ENV || '').toLowerCase();

    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;

    // Wrong Mongoose Object ID Error
    if (err.name === 'CastError') {
        error = new ErrorHandler(`Resource not found. Invalid: ${err.path}`, 400);
    }

    // Handling Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(value => value.message);
        error = new ErrorHandler(message, 400);
    }

    // Handling Mongoose duplicate key errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const friendlyField = field === 'email' ? 'adresse email' : field === 'phone' ? 'numéro de téléphone' : field;
        error = new ErrorHandler(`Un compte existe déjà avec cette ${friendlyField}.`, 409);
    }

    // Handling wrong JWT error
    if (err.name === 'JsonWebTokenError') {
        error = new ErrorHandler('JSON Web Token is invalid. Try Again!!!', 400);
    }

    // Handling Expired JWT error
    if (err.name === 'TokenExpiredError') {
        error = new ErrorHandler('JSON Web Token is expired. Try Again!!!', 400);
    }

    if (env !== 'production') {
        console.log(err);
    }

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal Server Error'
    });
}
