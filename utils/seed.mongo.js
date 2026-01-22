const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./db');
const { User, Storage, Reservation, Billing, Invoice } = require('../models');

dotenv.config({ path: './config/config.env' });

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const main = async () => {
  try {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      Storage.deleteMany({}),
      Reservation.deleteMany({}),
      Billing.deleteMany({}),
      Invoice.deleteMany({})
    ]);

    const users = await User.create([
      {
        name: 'Awa Ndiaye',
        email: 'awa.ndiaye@example.com',
        password: 'Password123!',
        phone: '+221770000001',
        role: 'PROPRIETAIRE'
      },
      {
        name: 'Moussa Diop',
        email: 'moussa.diop@example.com',
        password: 'Password123!',
        phone: '+221770000002',
        role: 'AGRICULTEUR'
      },
      {
        name: 'Fatou Seck',
        email: 'fatou.seck@example.com',
        password: 'Password123!',
        phone: '+221770000003',
        role: 'TRANSFORMATEUR'
      },
      {
        name: 'Cheikh Ba',
        email: 'cheikh.ba@example.com',
        password: 'Password123!',
        phone: '+221770000004',
        role: 'AGENT'
      }
    ]);

    const owner = users.find((u) => u.role === 'PROPRIETAIRE');
    const farmer = users.find((u) => u.role === 'AGRICULTEUR');

    const storages = await Storage.create([
      {
        owner: owner._id,
        location: 'Dakar - Rufisque',
        capacity: 1200,
        capacityUnit: 'M2',
        availableFrom: daysFromNow(-7),
        availableTo: daysFromNow(60),
        costPerKgPerDay: 10,
        productType: 'Maize',
        isAvailable: true
      },
      {
        owner: owner._id,
        location: 'Thiès - Keur Massar',
        capacity: 500,
        capacityUnit: 'M3',
        availableFrom: daysFromNow(0),
        availableTo: daysFromNow(30),
        costPerKgPerDay: 14,
        productType: 'Groundnut',
        isAvailable: true
      }
    ]);

    const reservation = await Reservation.create({
      user: farmer._id,
      storage: storages[0]._id,
      reservedFrom: daysFromNow(2),
      reservedTo: daysFromNow(12),
      status: 'CONFIRMÉ'
    });

    const start = new Date(reservation.reservedFrom);
    const end = new Date(reservation.reservedTo);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const totalAmount = days * storages[0].costPerKgPerDay;

    await Billing.create({
      reservation: reservation._id,
      user: farmer._id,
      storage: storages[0]._id,
      totalAmount,
      days,
      status: 'PENDING'
    });

    await Invoice.create([{}, {}]);

    console.log('✅ Mongo seed complete');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
