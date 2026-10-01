const User = require("./../models/User");
const Otp = require("../models/Otp");

const ErrorHandler = require("../utils/errorHandler");
const catchAsyncErrors = require("../middlewares/catchAsyncErrors");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const sendSms = require("../utils/sendSms");

const crypto = require("crypto");
const cloudinary = require("cloudinary");

// B9 — WebOTP (https://wicg.github.io/web-otp/) lets Chrome on Android
// auto-fill the code from SMS without the user opening the Messages app,
// but only if the SMS body's LAST line is exactly "@<domain> #<code>",
// domain being the site actually serving the page (no scheme, no path).
// Derived from FRONTEND_URL so this activates automatically once that's
// set to the real production domain — no code change needed then.
const webOtpDomain = () => {
  try {
    return new URL(process.env.FRONTEND_URL).host;
  } catch {
    return null;
  }
};
const withWebOtpSuffix = (message, code) => {
  const domain = webOtpDomain();
  return domain ? `${message}\n@${domain} #${code}` : message;
};

// Helper: generate a 6-digit OTP, save to DB, and send via SMS or email
// Controlled by OTP_CHANNEL env var: 'email' | 'sms' (default: 'sms')
const generateAndSendOtp = async (phone, type = 'REGISTER', email = null) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await Otp.deleteMany({ phone, type }); // clear previous OTPs of same type only
  await Otp.create({ phone, code, expiresAt, type });

  const body = type === 'RESET'
    ? `Votre code de réinitialisation ToleTech est : ${code}. Valide 10 minutes.`
    : `Votre code de vérification ToleTech est : ${code}. Valide 10 minutes.`;

  const subject = type === 'RESET'
    ? 'ToleTech — Code de réinitialisation'
    : 'ToleTech — Code de vérification';

  const channel = process.env.OTP_CHANNEL || 'sms';

  if (channel === 'email' && email) {
    void sendEmail({ email, subject, message: body }).catch((err) =>
      console.error("[OTP Email] Failed to send:", err?.message || err),
    );
  } else {
    // The WebOTP suffix only makes sense on the SMS the OS actually parses.
    void sendSms(phone, withWebOtpSuffix(body, code)).catch((err) =>
      console.error("[OTP SMS] Failed to send:", err?.message || err),
    );
  }

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
    await generateAndSendOtp(phone, 'REGISTER', email);
    const channel = process.env.OTP_CHANNEL || 'sms';
    return res.status(201).json({
      success: true,
      message: channel === 'email' && email
        ? "Inscription réussie. Vérifiez votre compte avec le code reçu par email."
        : "Inscription réussie. Vérifiez votre numéro avec le code reçu par SMS.",
      phone,
    });
  }

  await sendToken(user, 201, req, res);
});

// Login User  =>  /api/v1/auth/login
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, phone, password } = req.body;

  if (!email && !phone) {
    return next(new ErrorHandler("Veuillez indiquer votre email ou votre numéro de téléphone.", 400, 'VALIDATION_ERROR'));
  }

  // Finding user in database by email or phone
  const query = email ? { email } : { phone };
  const user = await User.findOne(query).select("+password");

  if (!user) {
    return next(new ErrorHandler("Email/téléphone ou mot de passe incorrect.", 401, 'AUTH_INVALID_CREDENTIALS'));
  }

  if (user.isActive === false) {
    return next(new ErrorHandler("Ce compte a été désactivé. Contactez un administrateur.", 403, 'ACCOUNT_DEACTIVATED'));
  }

  if (!user.isVerified) {
    return next(
      new ErrorHandler(
        "Numéro non vérifié. Veuillez vérifier votre compte.",
        403,
        'PHONE_NOT_VERIFIED',
      ),
    );
  }

  // Checks if password is correct or not
  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Email/téléphone ou mot de passe incorrect.", 401, 'AUTH_INVALID_CREDENTIALS'));
  }

  await sendToken(user, 200, req, res);
});

// Forgot Password (phone-based)   =>  POST /api/v1/auth/password/forgot
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const { phone } = req.body;

  if (!phone) {
    return next(new ErrorHandler("Le numéro de téléphone est requis.", 400, 'VALIDATION_ERROR'));
  }

  const user = await User.findOne({ phone });

  if (!user) {
    return next(new ErrorHandler("Aucun compte trouvé avec ce numéro.", 404, 'NOT_FOUND'));
  }

  await generateAndSendOtp(phone, 'RESET', user.email);

  const channel = process.env.OTP_CHANNEL || 'sms';
  res.status(200).json({
    success: true,
    message: channel === 'email' && user.email
      ? "Code envoyé par email. Utilisez-le pour vérifier votre identité avant de réinitialiser votre mot de passe."
      : "Code envoyé par SMS. Utilisez-le pour vérifier votre identité avant de réinitialiser votre mot de passe.",
    phone,
  });
});

// Verify Reset OTP — returns a short-lived reset token   =>  POST /api/v1/auth/password/verify-reset-otp
exports.verifyResetOtp = catchAsyncErrors(async (req, res, next) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return next(new ErrorHandler("Le numéro et le code OTP sont requis.", 400, 'VALIDATION_ERROR'));
  }

  const otp = await Otp.findOne({ phone, code, type: 'RESET' });

  if (!otp) {
    return next(new ErrorHandler("Code OTP invalide.", 400, 'OTP_INVALID'));
  }

  if (otp.expiresAt < new Date()) {
    await otp.deleteOne();
    return next(new ErrorHandler("Le code a expiré. Demandez-en un nouveau.", 400, 'OTP_EXPIRED'));
  }

  await otp.deleteOne();

  const user = await User.findOne({ phone });
  if (!user) {
    return next(new ErrorHandler("Utilisateur introuvable.", 404, 'NOT_FOUND'));
  }

  // Generate a short-lived reset token (15 min) stored hashed on the user doc
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    resetToken,
    message: "Code vérifié. Utilisez le resetToken pour définir votre nouveau mot de passe dans les 15 minutes.",
  });
});

// Reset Password   =>  PUT /api/v1/auth/password/reset
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { resetToken, password, confirmPassword } = req.body;

  if (!resetToken || !password || !confirmPassword) {
    return next(new ErrorHandler("resetToken, password et confirmPassword sont requis.", 400, 'VALIDATION_ERROR'));
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler("Les mots de passe ne correspondent pas.", 400, 'VALIDATION_ERROR'));
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
    return next(new ErrorHandler("Le lien de réinitialisation est invalide ou a expiré.", 400, 'RESET_TOKEN_INVALID'));
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.mustChangePassword = false;

  await user.save();

  await sendToken(user, 200, req, res);
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
    return next(new ErrorHandler("L'ancien mot de passe est incorrect.", 400, 'PASSWORD_INCORRECT'));
  }

  user.password = req.body.password;
  user.mustChangePassword = false;
  await user.save();

  await sendToken(user, 200, req, res);
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
    "roles",
  ];
  // Prevent self-elevation to privileged roles but preserve existing ones
  if (req.body.roles) {
    const PRIVILEGED = ['ADMIN', 'AGENT'];
    const requested = Array.isArray(req.body.roles) ? req.body.roles : [req.body.roles];
    const currentUser = await User.findById(req.user.id).select('roles');
    const existingPrivileged = (currentUser.roles || []).filter(r => PRIVILEGED.includes(r));
    const nonPrivileged = requested.filter(r => !PRIVILEGED.includes(r));
    req.body.roles = [...new Set([...nonPrivileged, ...existingPrivileged])];
    if (req.body.roles.length === 0) delete req.body.roles;
  }

  // Only touch email if it actually changed, and only against OTHER users —
  // the form always resubmits the current email, which must not self-collide
  // with the unique index (e.g. when just adding a role).
  if (req.body.email !== undefined) {
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const currentUser = await User.findById(req.user.id).select('email');
    if (normalizedEmail === currentUser.email) {
      delete req.body.email;
    } else {
      const emailTaken = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user.id } });
      if (emailTaken) {
        return next(new ErrorHandler('Un compte existe déjà avec cette adresse email.', 409));
      }
    }
  }

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
      await generateAndSendOtp(req.body.phone, 'REGISTER', currentUser.email);
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
  // B8 — revoke only THIS device's refresh token (not every session the user
  // has open elsewhere): pull the matching entry by its hash.
  const rawRefreshToken = req.cookies?.refreshToken;
  if (rawRefreshToken) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await User.updateOne(
      { 'refreshTokens.tokenHash': tokenHash },
      { $pull: { refreshTokens: { tokenHash } } },
    );
  }

  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  res.cookie('refreshToken', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
    path: '/api/v1/auth',
  });

  res.status(200).json({
    success: true,
    message: "Déconnexion réussie.",
  });
});

// B8 — POST /api/v1/auth/refresh. No isAuthenticatedUser here: this is
// called precisely because the access token has expired, using the
// long-lived refresh token cookie instead. Rotates the refresh token
// (single-use) so a leaked-then-replayed old cookie is immediately invalid.
exports.refreshToken = catchAsyncErrors(async (req, res, next) => {
  const rawRefreshToken = req.cookies?.refreshToken;
  if (!rawRefreshToken) {
    return next(new ErrorHandler('Session expirée. Veuillez vous reconnecter.', 401, 'AUTH_REQUIRED'));
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash }).select('+refreshTokens');

  if (!user) {
    res.cookie('refreshToken', null, { expires: new Date(0), httpOnly: true, path: '/api/v1/auth' });
    return next(new ErrorHandler('Session expirée. Veuillez vous reconnecter.', 401, 'AUTH_INVALID'));
  }

  const entry = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
  // Always drop the presented token — refresh tokens are single-use.
  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);

  if (!entry || entry.expiresAt < new Date()) {
    await user.save({ validateBeforeSave: false });
    res.cookie('refreshToken', null, { expires: new Date(0), httpOnly: true, path: '/api/v1/auth' });
    return next(new ErrorHandler('Session expirée. Veuillez vous reconnecter.', 401, 'AUTH_EXPIRED'));
  }

  await sendToken(user, 200, req, res);
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
    return next(new ErrorHandler("Le numéro et le code OTP sont requis.", 400, 'VALIDATION_ERROR'));
  }

  const otp = await Otp.findOne({ phone, code, verified: false });

  if (!otp) {
    return next(new ErrorHandler("Code OTP invalide.", 400, 'OTP_INVALID'));
  }

  if (otp.expiresAt < new Date()) {
    return next(new ErrorHandler("Le code a expiré.", 400, 'OTP_EXPIRED'));
  }

  otp.verified = true;
  await otp.save();

  const user = await User.findOneAndUpdate(
    { phone },
    { isVerified: true },
    { new: true },
  );

  if (!user) {
    return next(new ErrorHandler("Utilisateur introuvable.", 404, 'NOT_FOUND'));
  }

  await sendToken(user, 200, req, res);
});

// Verify phone change   =>   /api/v1/auth/verify-phone-change (authenticated)
exports.verifyPhoneChange = catchAsyncErrors(async (req, res, next) => {
  const { code } = req.body;

  if (!code) {
    return next(new ErrorHandler("Le code OTP est requis.", 400, 'VALIDATION_ERROR'));
  }

  const currentUser = await User.findById(req.user.id);
  if (!currentUser.pendingPhone) {
    return next(new ErrorHandler("Aucune demande de changement de numéro en cours.", 400, 'NO_PENDING_REQUEST'));
  }

  const otp = await Otp.findOne({
    phone: currentUser.pendingPhone,
    code,
    verified: false,
  });

  if (!otp) {
    return next(new ErrorHandler("Code OTP invalide.", 400, 'OTP_INVALID'));
  }

  if (otp.expiresAt < new Date()) {
    return next(new ErrorHandler("Le code a expiré.", 400, 'OTP_EXPIRED'));
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
      message: "Numéro de téléphone mis à jour avec succès.",
      data: currentUser,
    });
});

// S7-FE-01: Update notification channel preferences   =>   PUT /api/v1/auth/me/notif-prefs
// B4 (redesign plan §6.4) — extended to push + per-category overrides. Uses
// $set with dot paths instead of replacing the whole notifPrefs subdocument,
// so a partial body (e.g. just { push: false } from a single toggle in the
// preferences screen) doesn't wipe out the other channels/categories.
exports.updateNotifPrefs = catchAsyncErrors(async (req, res, next) => {
  const { sms, whatsapp, push, categories } = req.body;

  const set = {};
  if (sms !== undefined) set['notifPrefs.sms'] = !!sms;
  if (whatsapp !== undefined) set['notifPrefs.whatsapp'] = !!whatsapp;
  if (push !== undefined) set['notifPrefs.push'] = !!push;

  const VALID_CATEGORIES = ['reservations', 'transport', 'paiements', 'compte'];
  const VALID_CHANNELS = ['push', 'sms', 'whatsapp'];
  if (categories && typeof categories === 'object') {
    for (const cat of Object.keys(categories)) {
      if (!VALID_CATEGORIES.includes(cat)) continue;
      const channels = categories[cat];
      if (!channels || typeof channels !== 'object') continue;
      for (const ch of Object.keys(channels)) {
        if (!VALID_CHANNELS.includes(ch)) continue;
        set[`notifPrefs.categories.${cat}.${ch}`] = !!channels[ch];
      }
    }
  }

  if (Object.keys(set).length === 0) {
    return next(new ErrorHandler('Aucune préférence à mettre à jour', 400, 'VALIDATION_ERROR'));
  }

  const user = await User.findByIdAndUpdate(req.user.id, { $set: set }, { new: true });
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
      withWebOtpSuffix(`ToleTech — Code de vérification identité: ${code}. Valide 10 min.`, code),
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
    withWebOtpSuffix(`ToleTech — Code de confirmation nouveau numéro: ${code}. Valide 10 min.`, code),
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
    return next(new ErrorHandler("Le numéro de téléphone est requis.", 400, 'VALIDATION_ERROR'));
  }

  const user = await User.findOne({ phone });
  if (!user) {
    return next(new ErrorHandler("Aucun utilisateur trouvé avec ce numéro.", 404, 'NOT_FOUND'));
  }

  if (user.isVerified) {
    return next(new ErrorHandler("Ce numéro est déjà vérifié.", 400, 'ALREADY_VERIFIED'));
  }

  await generateAndSendOtp(phone, 'REGISTER', user.email);

  res.status(200).json({
    success: true,
    message: "Code renvoyé avec succès.",
  });
});

// Upload / replace profile photo   =>   PUT /api/v1/auth/me/avatar (multipart, field "avatar")
exports.updateAvatar = catchAsyncErrors(async (req, res, next) => {
  const { validateImages, uploadImage, destroyImage } = require('../utils/imageUpload');
  const file = req.files?.avatar;
  if (!file || Array.isArray(file)) {
    return next(new ErrorHandler('Une seule image est requise (champ "avatar").', 400));
  }
  const invalid = validateImages([file]);
  if (invalid) return next(invalid);

  const user = await User.findById(req.user.id);
  const previousId = user.avatar?.public_id;
  user.avatar = await uploadImage(file, { folder: 'avatars', maxSize: 512 });
  await user.save({ validateBeforeSave: false });
  await destroyImage(previousId);

  res.status(200).json({ success: true, user });
});

// Remove profile photo   =>   DELETE /api/v1/auth/me/avatar
exports.deleteAvatar = catchAsyncErrors(async (req, res, next) => {
  const { destroyImage } = require('../utils/imageUpload');
  const user = await User.findById(req.user.id);
  await destroyImage(user.avatar?.public_id);
  user.avatar = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, user });
});
