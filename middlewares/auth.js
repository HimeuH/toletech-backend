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
        return next(new ErrorHandler('Login first to access this resource.', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id);

    next()
})

// Handling users roles — supports multi-role: user passes if they hold ANY of the allowed roles
exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        const userRoles = req.user.roles || [];
        const hasRole = userRoles.some(r => roles.includes(r));
        if (!hasRole) {
            return next(
                new ErrorHandler(`Role (${userRoles.join(', ')}) is not allowed to access this resource`, 403))
        }
        next()
    }
}
