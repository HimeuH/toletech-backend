const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reservation = sequelize.define('Reservation', {
  reservedFrom: {
    type: DataTypes.DATE,
    allowNull: false
  },

  reservedTo: {
    type: DataTypes.DATE,
    allowNull: false
  },

  status: {
    type: DataTypes.ENUM('EN_ATTENTE', 'CONFIRMÉ', 'ANNULÉ'),
    defaultValue: 'EN_ATTENTE'
  }
}, {
  timestamps: true
});

module.exports = Reservation;