require('dotenv').config({ path: './config/config.env' });
const express = require('express');
const app = express();

const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload')
// const dotenv = require('dotenv');
const path = require('path')

const errorMiddleware = require('./middlewares/errors')

// Setting up config file 
if (process.env.NODE_ENV !== 'PRODUCTION') require('dotenv').config({ path: 'backend/config/config.env' })
// dotenv.config({ path: 'backend/config/config.env' })

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(fileUpload());


if (process.env.NODE_ENV === 'PRODUCTION') {
    app.use(express.static(path.join(__dirname, '../frontend/build')))

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../frontend/build/index.html'))
    })
}


// Middleware to handle errors
app.use(errorMiddleware);

//import routes
const userRoutes = require('./routes/user.routes');
const reservationRoutes = require('./routes/reservation.routes');
const storageRoutes = require('./routes/storage.routes');
const billingRoutes = require('./routes/billing.routes');


app.use('/api/v1/user', userRoutes);
app.use('/api/v1/reservation', reservationRoutes);
app.use('/api/v1/storage', storageRoutes);
app.use('/api/v1/billing', billingRoutes);

module.exports = app