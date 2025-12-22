const sequelize = require('../config/database');

const User = require('./User');
const Storage = require('./Storage');
const Reservation = require('./Reservation');
const Billing = require('./Billing');

/* =====================
   Relations SQL
===================== */

// User
User.hasMany(Storage, { foreignKey: 'ownerId' });
Storage.belongsTo(User, { as: 'owner', foreignKey: 'ownerId' });

User.hasMany(Reservation);
Reservation.belongsTo(User);

User.hasMany(Billing);
Billing.belongsTo(User);

// Storage
Storage.hasMany(Reservation);
Reservation.belongsTo(Storage);

Storage.hasMany(Billing);
Billing.belongsTo(Storage);

// Reservation
Reservation.hasOne(Billing);
Billing.belongsTo(Reservation);

module.exports = {
  sequelize,
  User,
  Storage,
  Reservation,
  Billing
};