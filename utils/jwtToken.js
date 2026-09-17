// Create and send an access token (short-lived) + refresh token (rotating,
// httpOnly cookie) — B8. Call sites pass `req` so the refresh token can be
// tagged with a best-effort device label (shown to the user as their list
// of signed-in sessions later; not security-critical, purely informational).
const sendToken = async (user, statusCode, req, res) => {
  const token = user.getAccessToken();

  const refreshToken = user.issueRefreshToken(deviceLabelFrom(req));
  await user.save({ validateBeforeSave: false });

  const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const refreshDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;

  // Scoped to /api/v1/auth: the browser only ever sends this cookie to the
  // refresh/logout endpoints, not to every API call — smaller CSRF surface.
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    expires: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
  });

  // Legacy cookie some deployments may still rely on — the access token
  // itself now self-expires in 15 min via its JWT `exp` claim regardless of
  // this cookie's Max-Age, so shortening it further isn't necessary.
  const cookieOptions = {
    expires: new Date(Date.now() + (process.env.COOKIE_EXPIRES_TIME || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };

  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;
  delete safeUser.refreshTokens;

  res.status(statusCode).cookie('token', token, cookieOptions).json({
    success: true,
    user: safeUser,
    token,
  });
};

function deviceLabelFrom(req) {
  const ua = req?.headers?.['user-agent'];
  if (!ua) return undefined;
  return ua.slice(0, 200);
}

module.exports = sendToken;
