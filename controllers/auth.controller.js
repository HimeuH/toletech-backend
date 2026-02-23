const User = require('./../models/User');
const Otp = require('../models/Otp');

const ErrorHandler = require('../utils/errorHandler');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const sendToken = require('../utils/jwtToken');
const sendEmail = require('../utils/sendEmail');
const sendSms = require('../utils/sendSms');

const crypto = require('crypto');
const cloudinary = require('cloudinary');

// Helper: generate a 6-digit OTP, save to DB, and send via SMS
const generateAndSendOtp = async (phone) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await Otp.deleteMany({ phone }); // clear any previous OTPs for this phone
    await Otp.create({ phone, code, expiresAt });

    await sendSms(phone, `Your ToleTech verification code is: ${code}. Valid for 10 minutes.`);
    return code;
};

// Register a user   => /api/v1/register
exports.registerUser = catchAsyncErrors(async (req, res, next) => {

    // const result = await cloudinary.v2.uploader.upload(req.body.avatar, {
    //     folder: 'avatars',
    //     width: 150,
    //     crop: "scale"
    // })

    const {
        name, email, password, phone, role,
        location, exploitationType, crops,
        companyName, companyRegistration, contactPerson,
        assignedRegion
    } = req.body;

    const user = await User.create({
        name, email, password, phone, role,
        location, exploitationType, crops,
        companyName, companyRegistration, contactPerson,
        assignedRegion,
        isVerified: phone ? false : true // verified immediately if no phone
    });

    if (phone) {
        await generateAndSendOtp(phone);
        return res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your phone number with the OTP sent via SMS.',
            phone
        });
    }

    sendToken(user, 201, res);

})

// Login User  =>  /api/v1/auth/login
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
    const { email, phone, password } = req.body;

    if (!email && !phone) {
        return next(new ErrorHandler('Please provide email or phone', 400));
    }

    // Finding user in database by email or phone
    const query = email ? { email } : { phone };
    const user = await User.findOne(query).select('+password')

    if (!user) {
        return next(new ErrorHandler('Invalid Email or Password', 401));
    }

    if (user.isActive === false) {
        return next(new ErrorHandler('Account deactivated. Contact admin.', 403));
    }

    if (!user.isVerified) {
        return next(new ErrorHandler('Phone number not verified. Please verify your account first.', 403));
    }

    // Checks if password is correct or not
    const isPasswordMatched = await user.comparePassword(password);

    if (!isPasswordMatched) {
        return next(new ErrorHandler('Invalid Email or Password', 401));
    }

    sendToken(user, 200, res)
})

// Forgot Password   =>  /api/v1/password/forgot
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return next(new ErrorHandler('User not found with this email', 404));
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset password url
    const resetUrl = `${req.protocol}://${req.get('host')}/password/reset/${resetToken}`;

    const message = `Your password reset token is as follow:\n\n${resetUrl}\n\nIf you have not requested this email, then ignore it.`

    try {

        await sendEmail({
            email: user.email,
            subject: 'ShopIT Password Recovery',
            message
        })

        res.status(200).json({
            success: true,
            message: `Email sent to: ${user.email}`
        })

    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });

        return next(new ErrorHandler(error.message, 500))
    }

})

// Reset Password   =>  /api/v1/password/reset/:token
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {

    // Hash URL token
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex')

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    })

    if (!user) {
        return next(new ErrorHandler('Password reset token is invalid or has been expired', 400))
    }

    if (req.body.password !== req.body.confirmPassword) {
        return next(new ErrorHandler('Password does not match', 400))
    }

    // Setup new password
    user.password = req.body.password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    sendToken(user, 200, res)

})


// Get currently logged in user details   =>   /api/v1/me
exports.getUserProfile = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        user
    })
})


// Update / Change password   =>  /api/v1/password/update
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+password');

    // Check previous user password
    const isMatched = await user.comparePassword(req.body.oldPassword)
    if (!isMatched) {
        return next(new ErrorHandler('Old password is incorrect'));
    }

    user.password = req.body.password;
    await user.save();

    sendToken(user, 200, res)

})


// Update user profile   =>   /api/v1/me/update
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
    const allowed = [
        'name', 'email',
        'location', 'exploitationType', 'crops',
        'companyName', 'companyRegistration', 'contactPerson',
        'assignedRegion'
    ];
    const newUserData = {};
    allowed.forEach(field => {
        if (req.body[field] !== undefined) newUserData[field] = req.body[field];
    });

    // If a new phone is being set, initiate OTP verification instead of saving directly
    if (req.body.phone) {
        const currentUser = await User.findById(req.user.id);
        if (req.body.phone !== currentUser.phone) {
            await User.findByIdAndUpdate(req.user.id, { pendingPhone: req.body.phone });
            await generateAndSendOtp(req.body.phone);
            return res.status(200).json({
                success: true,
                message: 'OTP sent to new phone number. Verify to confirm the change.'
            });
        }
    }

    const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({ success: true, data: user });
})


// Logout user   =>   /api/v1/logout
exports.logout = catchAsyncErrors(async (req, res, next) => {
    res.cookie('token', null, {
        expires: new Date(Date.now()),
        httpOnly: true
    })

    res.status(200).json({
        success: true,
        message: 'Logged out'
    })
})

// Admin Routes

// Get all users   =>   /api/v1/admin/users
exports.allUsers = catchAsyncErrors(async (req, res, next) => {
    const users = await User.find();

    res.status(200).json({
        success: true,
        users
    })
})


// Get user details   =>   /api/v1/admin/user/:id
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User does not found with id: ${req.params.id}`))
    }

    res.status(200).json({
        success: true,
        user
    })
})

// Update user profile   =>   /api/v1/admin/user/:id
exports.updateUser = catchAsyncErrors(async (req, res, next) => {
    const allowed = ['name', 'email', 'role', 'isActive', 'assignedRegion', 'location'];
    const newUserData = {};
    allowed.forEach(field => {
        if (req.body[field] !== undefined) newUserData[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
        new: true,
        runValidators: true,
    });

    if (!user) return next(new ErrorHandler(`User not found with id: ${req.params.id}`, 404));

    res.status(200).json({ success: true, data: user });
})

// Delete user   =>   /api/v1/admin/user/:id
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return next(new ErrorHandler(`User not found with id: ${req.params.id}`, 404));
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'User deleted' });
});

// Verify OTP   =>   /api/v1/auth/verify-otp
exports.verifyOtp = catchAsyncErrors(async (req, res, next) => {
    const { phone, code } = req.body;

    if (!phone || !code) {
        return next(new ErrorHandler('Phone and OTP code are required', 400));
    }

    const otp = await Otp.findOne({ phone, code, verified: false });

    if (!otp) {
        return next(new ErrorHandler('Invalid OTP code', 400));
    }

    if (otp.expiresAt < new Date()) {
        return next(new ErrorHandler('OTP has expired', 400));
    }

    otp.verified = true;
    await otp.save();

    const user = await User.findOneAndUpdate(
        { phone },
        { isVerified: true },
        { new: true }
    );

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    sendToken(user, 200, res);
});

// Verify phone change   =>   /api/v1/auth/verify-phone-change (authenticated)
exports.verifyPhoneChange = catchAsyncErrors(async (req, res, next) => {
    const { code } = req.body;

    if (!code) {
        return next(new ErrorHandler('OTP code is required', 400));
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser.pendingPhone) {
        return next(new ErrorHandler('No pending phone change found', 400));
    }

    const otp = await Otp.findOne({ phone: currentUser.pendingPhone, code, verified: false });

    if (!otp) {
        return next(new ErrorHandler('Invalid OTP code', 400));
    }

    if (otp.expiresAt < new Date()) {
        return next(new ErrorHandler('OTP has expired', 400));
    }

    otp.verified = true;
    await otp.save();

    currentUser.phone = currentUser.pendingPhone;
    currentUser.pendingPhone = undefined;
    await currentUser.save();

    res.status(200).json({ success: true, message: 'Phone number updated successfully', data: currentUser });
});

// Resend OTP   =>   /api/v1/auth/resend-otp
exports.resendOtp = catchAsyncErrors(async (req, res, next) => {
    const { phone } = req.body;

    if (!phone) {
        return next(new ErrorHandler('Phone number is required', 400));
    }

    const user = await User.findOne({ phone });
    if (!user) {
        return next(new ErrorHandler('User not found with this phone number', 404));
    }

    if (user.isVerified) {
        return next(new ErrorHandler('Phone number is already verified', 400));
    }

    await generateAndSendOtp(phone);

    res.status(200).json({
        success: true,
        message: 'OTP resent successfully'
    });
});