require('dotenv').config({ path: './config/config.env' });

// Initialize Cloudinary
require('./config/cloudinary');

const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const errorMiddleware = require('./middlewares/errors');

const app = express();


app.get('/', function(req, res) {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    res.send('Hello World!')
});

/* ======================
   Rate Limiters
====================== */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts, please try again in an hour.' }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts, please try again in an hour.' }
});

/* ======================
   Middlewares
====================== */
app.use(helmet());
app.use(generalLimiter);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));
app.use(
  cors({
    origin: ['http://localhost:4200', 'https://mvp.toletech.sn'],
    credentials: true
  })
);

/* ======================
   Routes
====================== */
const userRoutes = require('./routes/user.routes');
const reservationRoutes = require('./routes/reservation.routes');
const storageRoutes = require('./routes/storage.routes');
const billingRoutes = require('./routes/billing.routes');
const authRoutes = require('./routes/auth.routes');
const notificationRoutes = require('./routes/notification.routes');
const agentRoutes = require('./routes/agent.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/auth/register', registerLimiter);
app.use('/api/v1/auth/password/forgot', forgotPasswordLimiter);

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/storages', storageRoutes);
app.use('/api/v1/billings', billingRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/agent', agentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

/* ======================
   Frontend (PROD)
====================== */
if (process.env.NODE_ENV === 'PRODUCTION') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(
      path.resolve(__dirname, '../frontend/build/index.html')
    );
  });
}

/* ======================
   Error handler
====================== */
app.use(errorMiddleware);


module.exports = app;
