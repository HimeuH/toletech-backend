require('dotenv').config({ path: './config/config.env' });

// Override SMS_PROVIDER in test env so sendSms falls back to console.log
process.env.SMS_PROVIDER = '';

const mongoose = require('mongoose');

const MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/toletech_test';

beforeAll(async () => {
  await mongoose.connect(MONGO_URI);
});

afterEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});
