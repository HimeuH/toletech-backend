require('dotenv').config({ path: './config/config.env' });

const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 8080;

/* ======================
   Database Connection
====================== */
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ SQLite database connected');

    await sequelize.sync({ alter: true });
    console.log('✅ Models synchronized');

    const server = app.listen(PORT, () => {
      console.log(
        `🚀 Server running on PORT ${PORT} in ${process.env.NODE_ENV} mode`
      );
    });

    /* ======================
       Unhandled Rejections
    ====================== */
    process.on('unhandledRejection', (err) => {
      console.error(`❌ Unhandled Rejection: ${err.message}`);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

startServer();

/* ======================
   Uncaught Exceptions
====================== */
process.on('uncaughtException', (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  process.exit(1);
});