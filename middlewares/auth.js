const User = require('./../models/User');

const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/errorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");

// Checks if user is authenticated or not
exports.isAuthenticatedUser = catchAsyncErrors(async (req, res, next) => {

    let token = req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new ErrorHandler('Veuillez vous connecter pour accéder à cette ressource.', 401, 'AUTH_REQUIRED'))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id);

    if (!req.user) {
        return next(new ErrorHandler('Votre session a expiré. Veuillez vous reconnecter.', 401, 'AUTH_EXPIRED'))
    }

    next()
})

// Handling users roles — supports multi-role: user passes if they hold ANY of the allowed roles
exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        const userRoles = req.user.roles || [];
        const hasRole = userRoles.some(r => roles.includes(r));
        if (!hasRole) {
            return next(
                new ErrorHandler("Vous n'avez pas la permission d'accéder à cette ressource.", 403, 'FORBIDDEN'))
        }
        next()
    }
}
