require('dotenv').config({ path: './config/config.env' });

const app = require('./app');
const connectDB = require('./utils/db');

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectDB();

    // S4: start payout cron job after DB is ready
    require('./utils/payoutJob');

    const server = app.listen(PORT, () => {
      console.log(
        `🚀 Server running on PORT ${PORT} in ${process.env.NODE_ENV} mode`
      );
    });

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

process.on('uncaughtException', (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  process.exit(1);
});
