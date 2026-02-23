module.exports = (res, statusCode, data = null, message = '') => {
  res.status(statusCode).json({ success: statusCode < 400, data, message });
};
