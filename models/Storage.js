const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Storage = sequelize.define('Storage', {
  location: {
    type: DataTypes.STRING,
    allowNull: false
  },

  capacity: {
    type: DataTypes.FLOAT,
    allowNull: false
  },

  capacityUnit: {
    type: DataTypes.ENUM('M2', 'HA', 'L', 'M3'),
    allowNull: false
  },

  availableFrom: {
    type: DataTypes.DATE,
    allowNull: false
  },

  availableTo: {
    type: DataTypes.DATE,
    allowNull: false
  },

  costPerKgPerDay: {
    type: DataTypes.FLOAT,
    allowNull: false
  },

  productType: DataTypes.STRING,

  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

module.exports = Storage;