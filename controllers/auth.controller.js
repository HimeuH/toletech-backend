const User = require("./../models/User");
const Otp = require("../models/Otp");

const ErrorHandler = require("../utils/errorHandler");
const catchAsyncErrors = require("../middlewares/catchAsyncErrors");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const sendSms = require("../utils/sendSms");

const crypto = require("crypto");
const cloudinary = require("cloudinary");

// Helper: generate a 6-digit OTP, save to DB, and send via SMS
const generateAndSendOtp = async (phone, type = 'REGISTER') => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await Otp.deleteMany({ phone, type }); // clear previous OTPs of same type only
  await Otp.create({ phone, code, expiresAt, type });

  const message = type === 'RESET'
    ? `Votre code de réinitialisation ToleTech est: ${code}. Valide 10 minutes.`
    : `Your ToleTech verification code is: ${code}. Valid for 10 minutes.`;

  void sendSms(phone, message).catch((err) =>
    console.error("[OTP SMS] Failed to send:", err?.message || err),
  );
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
    name,
    email,
    password,
    phone,
    roles,
    role, // legacy single-role support
    location,
    exploitationType,
    crops,
    companyName,
    companyRegistration,
    contactPerson,
    assignedRegion,
    vehicleType,
    vehicleCapacity,
    vehiclePlate,
    serviceZones,
  } = req.body;

  // Accept roles array or fallback to legacy single role field
  const userRoles = roles ? (Array.isArray(roles) ? roles : [roles])
    : role ? [role]
    : ['AGRICULTEUR'];

  const user = await User.create({
    name,
    email,
    password,
    phone,
    roles: userRoles,
    location,
    exploitationType,
    crops,
    companyName,
    companyRegistration,
    contactPerson,
    assignedRegion,
    vehicleType,
    vehicleCapacity,
    vehiclePlate,
    serviceZones,
    isVerified: phone ? false : true, // verified immediately if no phone
  });

  if (phone) {
    await generateAndSendOtp(phone);
    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please verify your phone number with the OTP sent via SMS.",
      phone,
    });
  }

  sendToken(user, 201, res);
});

// Login User  =>  /api/v1/auth/login
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, phone, password } = req.body;

  if (!email && !phone) {
    return next(new ErrorHandler("Please provide email or phone", 400));
  }

  // Finding user in database by email or phone
  const query = email ? { email } : { phone };
  const user = await User.findOne(query).select("+password");

  if (!user) {
    return next(new ErrorHandler("Invalid Email or Password", 401));
  }

  if (user.isActive === false) {
    return next(new ErrorHandler("Account deactivated. Contact admin.", 403));
  }

  if (!user.isVerified) {
    return next(
      new ErrorHandler(
        "Phone number not verified. Please verify your account first.",
        403,
      ),
    );
  }

  // Checks if password is correct or not
  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid Email or Password", 401));
  }

  sendToken(user, 200, res);
});

// Forgot Password (phone-based)   =>  POST /api/v1/auth/password/forgot
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone) {
    return next(new ErrorHandler("Phone number is required", 400));
  }

  const user = await User.findOne({ phone });

  if (!user) {
    return next(new ErrorHandler("No account found with this phone number", 404));
  }

  await generateAndSendOtp(phone, 'RESET');

  res.status(200).json({
    success: true,
    message: "OTP sent via SMS. Use it to verify your identity before resetting your password.",
    phone,
  });
});

// Verify Reset OTP — returns a short-lived reset token   =>  POST /api/v1/auth/password/verify-reset-otp
exports.verifyResetOtp = catchAsyncErrors(async (req, res, next) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return next(new ErrorHandler("Phone and OTP code are required", 400));
  }

  const otp = await Otp.findOne({ phone, code, type: 'RESET' });

  if (!otp) {
    return next(new ErrorHandler("Invalid OTP code", 400));
  }

  if (otp.expiresAt < new Date()) {
    await otp.deleteOne();
    return next(new ErrorHandler("OTP has expired. Request a new one.", 400));
  }

  await otp.deleteOne();

  const user = await User.findOne({ phone });
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Generate a short-lived reset token (15 min) stored hashed on the user doc
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    resetToken,
    message: "OTP verified. Use the resetToken to set your new password within 15 minutes.",
  });
});

// Reset Password   =>  PUT /api/v1/auth/password/reset
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { resetToken, password, confirmPassword } = req.body;

  if (!resetToken || !password || !confirmPassword) {
    return next(new ErrorHandler("resetToken, password and confirmPassword are required", 400));
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler("Passwords do not match", 400));
  }

  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorHandler("Reset token is invalid or has expired", 400));
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.mustChangePassword = false;

  await user.save();

  sendToken(user, 200, res);
});

// Get currently logged in user details   =>   /api/v1/me
exports.getUserProfile = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    user,
  });
});

// Update / Change password   =>  /api/v1/password/update
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  // Check previous user password
  const isMatched = await user.comparePassword(req.body.oldPassword);
  if (!isMatched) {
    return next(new ErrorHandler("Old password is incorrect"));
  }

  user.password = req.body.password;
  user.mustChangePassword = false;
  await user.save();

  sendToken(user, 200, res);
});

// Update user profile   =>   /api/v1/me/update
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
  const allowed = [
    "name",
    "email",
    "location",
    "exploitationType",
    "crops",
    "companyName",
    "companyRegistration",
    "contactPerson",
    "assignedRegion",
    "vehicleType",
    "vehicleCapacity",
    "vehiclePlate",
    "serviceZones",
    "isAvailableForTransport",
    "payoutFrequencyDays",
  ];
  const newUserData = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) newUserData[field] = req.body[field];
  });

  // If a new phone is being set, initiate OTP verification instead of saving directly
  if (req.body.phone) {
    const currentUser = await User.findById(req.user.id);
    if (req.body.phone !== currentUser.phone) {
      await User.findByIdAndUpdate(req.user.id, {
        pendingPhone: req.body.phone,
      });
      await generateAndSendOtp(req.body.phone);
      return res.status(200).json({
        success: true,
        message: "OTP sent to new phone number. Verify to confirm the change.",
      });
    }
  }

  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: user });
});

// Logout user   =>   /api/v1/logout
exports.logout = catchAsyncErrors(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged out",
  });
});

// Admin Routes

// Get all users   =>   /api/v1/admin/users
exports.allUsers = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    success: true,
    users,
  });
});

// Get user details   =>   /api/v1/admin/user/:id
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User does not found with id: ${req.params.id}`),
    );
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// Update user profile   =>   /api/v1/admin/user/:id
exports.updateUser = catchAsyncErrors(async (req, res, next) => {
  const allowed = [
    "name",
    "email",
    "roles",
    "isActive",
    "assignedRegion",
    "location",
    "payoutFrequencyDays",
  ];
  const newUserData = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) newUserData[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
    runValidators: true,
  });

  if (!user)
    return next(
      new ErrorHandler(`User not found with id: ${req.params.id}`, 404),
    );

  res.status(200).json({ success: true, data: user });
});

// Delete user   =>   /api/v1/admin/user/:id
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHandler(`User not found with id: ${req.params.id}`, 404),
    );
  }

  await User.findByIdAndDelete(req.params.id);

  res.status(200).json({ success: true, message: "User deleted" });
});

// Verify OTP   =>   /api/v1/auth/verify-otp
exports.verifyOtp = catchAsyncErrors(async (req, res, next) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return next(new ErrorHandler("Phone and OTP code are required", 400));
  }

  const otp = await Otp.findOne({ phone, code, verified: false });

  if (!otp) {
    return next(new ErrorHandler("Invalid OTP code", 400));
  }

  if (otp.expiresAt < new Date()) {
    return next(new ErrorHandler("OTP has expired", 400));
  }

  otp.verified = true;
  await otp.save();

  const user = await User.findOneAndUpdate(
    { phone },
    { isVerified: true },
    { new: true },
  );

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  sendToken(user, 200, res);
});

// Verify phone change   =>   /api/v1/auth/verify-phone-change (authenticated)
exports.verifyPhoneChange = catchAsyncErrors(async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return next(new ErrorHandler("OTP code is required", 400));
  }

  const currentUser = await User.findById(req.user.id);
  if (!currentUser.pendingPhone) {
    return next(new ErrorHandler("No pending phone change found", 400));
  }

  const otp = await Otp.findOne({
    phone: currentUser.pendingPhone,
    code,
    verified: false,
  });

  if (!otp) {
    return next(new ErrorHandler("Invalid OTP code", 400));
  }

  if (otp.expiresAt < new Date()) {
    return next(new ErrorHandler("OTP has expired", 400));
  }

  otp.verified = true;
  await otp.save();

  currentUser.phone = currentUser.pendingPhone;
  currentUser.pendingPhone = undefined;
  await currentUser.save();

  res
    .status(200)
    .json({
      success: true,
      message: "Phone number updated successfully",
      data: currentUser,
    });
});

// S7-FE-01: Update notification channel preferences   =>   PUT /api/v1/auth/me/notif-prefs
exports.updateNotifPrefs = catchAsyncErrors(async (req, res, next) => {
  const { sms, whatsapp } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { notifPrefs: { sms: sms !== false, whatsapp: !!whatsapp } },
    { new: true }
  );
  res.status(200).json({ success: true, data: user });
});

// ─── SPRINT 5: Secured phone change flow ─────────────────────────────────────

// S5-BE-02: Step 1 — request identity verification OTP
// Chemin A : OTP SMS on current phone
// Chemin B : OTP email if no phone
// POST /api/v1/auth/request-phone-change  (authenticated)
exports.requestPhoneChange = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (user.phone) {
    // Chemin A — SMS on old number
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.phoneChangeEmailCode = crypto.createHash('sha256').update(code).digest('hex');
    user.phoneChangeEmailExpiry = expiresAt;
    await user.save({ validateBeforeSave: false });

    void sendSms(
      user.phone,
      `ToleTech — Code de vérification identité: ${code}. Valide 10 min.`,
    ).catch((err) => console.error('[PhoneChange SMS]', err?.message || err));

    return res.status(200).json({
      success: true,
      channel: 'sms',
      message: 'OTP envoyé par SMS sur votre ancien numéro.',
    });
  }

  // Chemin B — OTP via email
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.phoneChangeEmailCode = crypto.createHash('sha256').update(code).digest('hex');
  user.phoneChangeEmailExpiry = expiresAt;
  await user.save({ validateBeforeSave: false });

  void sendEmail({
    email: user.email,
    subject: 'ToleTech — Vérification identité pour changement de numéro',
    message: `Votre code de vérification ToleTech est : ${code}\nValide 10 minutes.`,
  }).catch((err) => console.error('[PhoneChange Email]', err?.message || err));

  return res.status(200).json({
    success: true,
    channel: 'email',
    message: `OTP envoyé par email à ${user.email}.`,
  });
});

// S5-BE-03: Step 2 — verify identity OTP → returns phoneChangeToken
// POST /api/v1/auth/verify-identity  (authenticated)
exports.verifyIdentity = catchAsyncErrors(async (req, res, next) => {
  const { code } = req.body;
  if (!code) return next(new ErrorHandler('Le code OTP est requis', 400));

  const user = await User.findById(req.user.id);

  if (!user.phoneChangeEmailCode || !user.phoneChangeEmailExpiry) {
    return next(new ErrorHandler("Aucune demande de vérification en cours. Relancez l'étape 1.", 400));
  }

  if (user.phoneChangeEmailExpiry < new Date()) {
    user.phoneChangeEmailCode = undefined;
    user.phoneChangeEmailExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler('OTP expiré. Relancez la demande.', 400));
  }

  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  if (hashedCode !== user.phoneChangeEmailCode) {
    return next(new ErrorHandler('Code OTP invalide.', 400));
  }

  // Identity confirmed — generate short-lived phoneChangeToken (15 min)
  const rawToken = crypto.randomBytes(20).toString('hex');
  user.phoneChangeToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.phoneChangeTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
  user.phoneChangeEmailCode = undefined;
  user.phoneChangeEmailExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    phoneChangeToken: rawToken,
    message: 'Identité vérifiée. Utilisez phoneChangeToken pour saisir le nouveau numéro (valide 15 min).',
  });
});

// S5-BE-04a: Step 3a — submit new phone (sends OTP to new number)
// POST /api/v1/auth/submit-new-phone  (authenticated)
exports.submitNewPhone = catchAsyncErrors(async (req, res, next) => {
  const { newPhone, phoneChangeToken } = req.body;
  if (!newPhone || !phoneChangeToken) {
    return next(new ErrorHandler('newPhone et phoneChangeToken sont requis', 400));
  }

  const user = await User.findById(req.user.id);

  // Validate phoneChangeToken
  if (!user.phoneChangeToken || !user.phoneChangeTokenExpiry) {
    return next(new ErrorHandler("Aucun token de changement actif. Recommencez depuis l'étape 1.", 400));
  }
  if (user.phoneChangeTokenExpiry < new Date()) {
    user.phoneChangeToken = undefined;
    user.phoneChangeTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler('Token expiré. Recommencez depuis le début.', 400));
  }
  const hashedToken = crypto.createHash('sha256').update(phoneChangeToken).digest('hex');
  if (hashedToken !== user.phoneChangeToken) {
    return next(new ErrorHandler('Token invalide.', 401));
  }

  if (newPhone === user.phone) {
    return next(new ErrorHandler('Le nouveau numéro est identique à l\'ancien.', 400));
  }

  // Check new phone not already taken by another user
  const existing = await User.findOne({ phone: newPhone });
  if (existing) {
    return next(new ErrorHandler('Ce numéro est déjà utilisé par un autre compte.', 409));
  }

  // Send OTP to new phone
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.deleteMany({ phone: newPhone, type: 'PHONE_NEW' });
  await Otp.create({ phone: newPhone, code, expiresAt, type: 'PHONE_NEW' });

  user.pendingPhone = newPhone;
  await user.save({ validateBeforeSave: false });

  void sendSms(
    newPhone,
    `ToleTech — Code de confirmation nouveau numéro: ${code}. Valide 10 min.`,
  ).catch((err) => console.error('[NewPhone SMS]', err?.message || err));

  res.status(200).json({
    success: true,
    message: 'OTP envoyé sur le nouveau numéro. Confirmez pour finaliser le changement.',
  });
});

// S5-BE-04b: Step 3b — verify new phone OTP + commit
// POST /api/v1/auth/verify-new-phone  (authenticated)
exports.verifyNewPhone = catchAsyncErrors(async (req, res, next) => {
  const { code } = req.body;
  if (!code) return next(new ErrorHandler('Le code OTP est requis', 400));

  const user = await User.findById(req.user.id);

  if (!user.pendingPhone) {
    return next(new ErrorHandler('Aucun numéro en attente de confirmation.', 400));
  }

  const otp = await Otp.findOne({ phone: user.pendingPhone, code, type: 'PHONE_NEW', verified: false });
  if (!otp) {
    return next(new ErrorHandler('Code OTP invalide.', 400));
  }
  if (otp.expiresAt < new Date()) {
    await otp.deleteOne();
    return next(new ErrorHandler('OTP expiré. Recommencez l\'étape 3.', 400));
  }

  await otp.deleteOne();

  // Commit
  user.phone = user.pendingPhone;
  user.pendingPhone = undefined;
  user.phoneChangeToken = undefined;
  user.phoneChangeTokenExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Numéro de téléphone mis à jour avec succès.',
    data: { phone: user.phone },
  });
});

// ─────────────────────────────────────────────────────────────────────────────

// Create Agent (admin only)   =>   /api/v1/auth/admin/agents
exports.createAgent = catchAsyncErrors(async (req, res, next) => {
  const { name, email, phone, assignedRegion, identificationNumber } = req.body;

  const password = crypto.randomBytes(8).toString("hex");

  const agent = await User.create({
    name,
    email,
    phone,
    assignedRegion,
    identificationNumber,
    roles: ["AGENT"],
    password,
    isActive: true,
    isVerified: true,
    mustChangePassword: true,
  });

  // Send credentials via SMS (fire-and-forget so creation is not blocked)
  void sendSms(
    phone,
    `Bienvenue sur ToleTech. Votre mot de passe: ${password}`,
  ).catch((err) =>
    console.error(
      "[Agent SMS] Failed to send credentials:",
      err?.message || err,
    ),
  );

  const agentData = agent.toObject();
  delete agentData.password;

  // Return the plain-text password once so the admin can note it down
  // (the stored value is already hashed by the pre-save hook)
  res.status(201).json({
    success: true,
    data: agentData,
    temporaryPassword: password,
    message:
      "Agent created. Credentials sent via SMS. Store the temporaryPassword — it will not be shown again.",
  });
});

// Resend OTP   =>   /api/v1/auth/resend-otp
exports.resendOtp = catchAsyncErrors(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone) {
    return next(new ErrorHandler("Phone number is required", 400));
  }

  const user = await User.findOne({ phone });
  if (!user) {
    return next(new ErrorHandler("User not found with this phone number", 404));
  }

  if (user.isVerified) {
    return next(new ErrorHandler("Phone number is already verified", 400));
  }

  await generateAndSendOtp(phone);

  res.status(200).json({
    success: true,
    message: "OTP resent successfully",
  });
});
