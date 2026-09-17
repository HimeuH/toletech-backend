const express = require('express');
const router = express.Router();
const cityController = require('../controllers/city.controller');

// Public — no auth required, same as product-types reference data.
router.get('/nearest', cityController.getNearestCity);
router.get('/', cityController.listCities);

module.exports = router;
