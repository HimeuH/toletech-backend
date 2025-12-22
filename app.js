require('dotenv').config({ path: './config/config.env' });

const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const path = require('path');

const errorMiddleware = require('./middlewares/errors');

const app = express();


app.get('/', function(req, res) {
    res.set('Content-Type', 'text/html; charset=UTF-8')
    res.send('Hello World!')
});

/* ======================
   Middlewares
====================== */
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());

/* ======================
   Routes
====================== */
const userRoutes = require('./routes/user.routes');
const reservationRoutes = require('./routes/reservation.routes');
const storageRoutes = require('./routes/storage.routes');
const billingRoutes = require('./routes/billing.routes');

app.use('/api/v1/user', userRoutes);
app.use('/api/v1/reservation', reservationRoutes);
app.use('/api/v1/storage', storageRoutes);
app.use('/api/v1/billing', billingRoutes);

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