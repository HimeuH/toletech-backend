const User = require('./User');
const Storage = require('./Storage');
const Reservation = require('./Reservation');
const Billing = require('./Billing');
const Invoice = require('./Invoice');
const Otp = require('./Otp');
const CommissionConfig = require('./CommissionConfig');
const PaymentProviderConfig = require('./PaymentProviderConfig');

module.exports = {
  User,
  Storage,
  Reservation,
  Billing,
  Invoice,
  Otp,
  CommissionConfig,
  PaymentProviderConfig
};
