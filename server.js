require('dotenv').config({ path: './config/config.env' });

const app = require('./app');
const connectDB = require('./utils/db');

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectDB();

    // S4: start payout cron job after DB is ready
    require('./utils/payoutJob');

    // PI-SPI: check mTLS cert expiry at startup (blocks start if < 7 days remain)
    if (process.env.PISPI_ENABLED === 'true') {
      const { checkCertExpiry } = require('./utils/pispiCertMonitor');
      const daysLeft = checkCertExpiry();
      console.log(`[PISPI] mTLS cert valid for ${daysLeft} days`);

      // Daily cert expiry check at 08:00
      const cron = require('node-cron');
      cron.schedule('0 8 * * *', () => {
        try { checkCertExpiry(); }
        catch (e) { console.error('[PISPI] Cert expiry alert:', e.message); }
      });
    }

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
