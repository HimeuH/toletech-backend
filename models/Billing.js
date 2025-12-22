const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Billing = sequelize.define('Billing', {
  totalAmount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },

  currency: {
    type: DataTypes.STRING,
    defaultValue: 'XOF'
  },

  days: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'CANCELLED'),
    defaultValue: 'PENDING'
  },

  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Billing;