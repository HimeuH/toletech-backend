// DB config placeholder
// module.exports = { url: 'mongodb://localhost:27017/toletech' };
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db/database.sqlite', // fichier local
  logging: false
});

module.exports = sequelize;
