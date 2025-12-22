const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },

  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },

  password: {
    type: DataTypes.STRING,
    allowNull: false
  },

  phone: DataTypes.STRING,

  role: {
    type: DataTypes.ENUM(
      'AGRICULTEUR',
      'PROPRIETAIRE',
      'TRANSFORMATEUR',
      'AGENT'
    ),
    defaultValue: 'AGRICULTEUR'
  }
}, {
  timestamps: true
});

module.exports = User;