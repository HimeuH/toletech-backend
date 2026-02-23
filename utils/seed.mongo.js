const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./db');
const { User, Storage, StorageSpace, Reservation, Billing, Otp } = require('../models');

dotenv.config({ path: './config/config.env' });

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const main = async () => {
  try {
    await connectDB();

    // Clear collections
    await Promise.all([
      User.deleteMany({}),
      Storage.deleteMany({}),
      StorageSpace.deleteMany({}),
      Reservation.deleteMany({}),
      Billing.deleteMany({}),
      Otp.deleteMany({})
    ]);

    // ── Users ──────────────────────────────────────────────
    const users = await User.create([
      {
        name: 'Admin User',
        email: 'admin@toletech.com',
        password: 'Admin123!',
        phone: '+221770000999',
        role: 'ADMIN',
        isActive: true,
        isVerified: true
      },
      {
        name: 'Awa Ndiaye',
        email: 'awa.ndiaye@example.com',
        password: 'Password123!',
        phone: '+221770000001',
        role: 'PROPRIETAIRE',
        location: 'Dakar',
        companyName: 'Grenier Ndiaye',
        isActive: true,
        isVerified: true
      },
      {
        name: 'Fatou Seck',
        email: 'fatou.seck@example.com',
        password: 'Password123!',
        phone: '+221770000003',
        role: 'TRANSFORMATEUR',
        location: 'Thiès',
        companyName: 'Seck Agro Transform',
        isActive: true,
        isVerified: true
      },
      {
        name: 'Moussa Diop',
        email: 'moussa.diop@example.com',
        password: 'Password123!',
        phone: '+221770000002',
        role: 'AGRICULTEUR',
        location: 'Kaolack',
        exploitationType: 'Céréales',
        crops: ['Mil', 'Maïs', 'Arachide'],
        isActive: true,
        isVerified: true
      },
      {
        name: 'Ibou Fall',
        email: 'ibou.fall@example.com',
        password: 'Password123!',
        phone: '+221770000005',
        role: 'AGRICULTEUR',
        location: 'Ziguinchor',
        exploitationType: 'Maraîchage',
        crops: ['Tomate', 'Oignon'],
        isActive: true,
        isVerified: true
      },
      {
        name: 'Cheikh Ba',
        email: 'cheikh.ba@example.com',
        password: 'Password123!',
        phone: '+221770000004',
        role: 'AGENT',
        location: 'Thiès',
        assignedRegion: 'Thiès',
        isActive: true,
        isVerified: true
      }
    ]);

    const owner     = users.find(u => u.role === 'PROPRIETAIRE');
    const transform = users.find(u => u.role === 'TRANSFORMATEUR');
    const farmer1   = users.find(u => u.email === 'moussa.diop@example.com');
    const farmer2   = users.find(u => u.email === 'ibou.fall@example.com');

    // ── Storages ───────────────────────────────────────────
    const storages = await Storage.create([
      {
        owner: owner._id,
        createdBy: owner._id,
        name: 'Grenier Rufisque',
        storageType: 'SILO',
        location: 'Dakar - Rufisque',
        address: { city: 'Rufisque', region: 'Dakar', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-17.2742, 14.7167] },
        description: 'Grand silo pour céréales, accès 24h/24.',
        facilities: ['electricity', 'security', 'ventilation'],
        accessHours: '24h/24 - 7j/7',
        capacity: 1200,
        capacityUnit: 'TONNES',
        availableFrom: daysFromNow(-7),
        availableTo: daysFromNow(120),
        costPerKgPerDay: 10,
        productType: 'Maïs',
        isAvailable: true
      },
      {
        owner: owner._id,
        createdBy: owner._id,
        name: 'Hangar Keur Massar',
        storageType: 'HANGAR',
        location: 'Thiès - Keur Massar',
        address: { city: 'Keur Massar', region: 'Thiès', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-16.9583, 14.7833] },
        description: 'Hangar polyvalent pour arachides et légumineuses.',
        facilities: ['security'],
        accessHours: 'Lun-Sam 07h-19h',
        capacity: 500,
        capacityUnit: 'M3',
        availableFrom: daysFromNow(0),
        availableTo: daysFromNow(90),
        costPerKgPerDay: 14,
        productType: 'Arachide',
        isAvailable: true
      },
      {
        owner: transform._id,
        createdBy: transform._id,
        name: 'Chambre Froide Thiès',
        storageType: 'CHAMBRE_FROIDE',
        location: 'Thiès Centre',
        address: { city: 'Thiès', region: 'Thiès', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-16.9300, 14.7910] },
        description: 'Chambre froide pour fruits, légumes et produits laitiers.',
        facilities: ['electricity', 'ventilation', 'security'],
        accessHours: 'Lun-Ven 06h-20h',
        capacity: 200,
        capacityUnit: 'M3',
        availableFrom: daysFromNow(-14),
        availableTo: daysFromNow(60),
        costPerKgPerDay: 25,
        productType: 'Légumes',
        isAvailable: true
      }
    ]);

    // ── Storage Spaces ─────────────────────────────────────
    await StorageSpace.create([
      {
        storage: storages[0]._id,
        name: 'Zone A',
        capacity: 400,
        capacityUnit: 'TONNES',
        price: 4000,
        pricingPeriod: 'MONTHLY',
        availableFrom: daysFromNow(0),
        availableTo: daysFromNow(120),
        status: 'DISPONIBLE'
      },
      {
        storage: storages[0]._id,
        name: 'Zone B',
        capacity: 400,
        capacityUnit: 'TONNES',
        price: 4000,
        pricingPeriod: 'MONTHLY',
        availableFrom: daysFromNow(0),
        availableTo: daysFromNow(120),
        status: 'DISPONIBLE'
      },
      {
        storage: storages[1]._id,
        name: 'Espace Principal',
        capacity: 500,
        capacityUnit: 'M3',
        price: 7000,
        pricingPeriod: 'MONTHLY',
        availableFrom: daysFromNow(0),
        availableTo: daysFromNow(90),
        status: 'DISPONIBLE'
      }
    ]);

    // ── Reservations ───────────────────────────────────────
    const reservation1 = await Reservation.create({
      user: farmer1._id,
      storage: storages[0]._id,
      reservedFrom: daysFromNow(2),
      reservedTo: daysFromNow(12),
      status: 'CONFIRMÉ'
    });

    await Reservation.create({
      user: farmer2._id,
      storage: storages[1]._id,
      reservedFrom: daysFromNow(5),
      reservedTo: daysFromNow(20),
      status: 'EN_ATTENTE'
    });

    // ── Billing for confirmed reservation ──────────────────
    const days = Math.ceil(
      (new Date(reservation1.reservedTo) - new Date(reservation1.reservedFrom)) / (1000 * 60 * 60 * 24)
    );
    await Billing.create({
      reservation: reservation1._id,
      user: farmer1._id,
      storage: storages[0]._id,
      totalAmount: days * storages[0].costPerKgPerDay,
      days,
      status: 'PENDING'
    });

    // ── Summary ────────────────────────────────────────────
    console.log('\n✅  Seed complete\n');
    console.log('   Users:');
    users.forEach(u =>
      console.log(`   • ${u.role.padEnd(14)} ${u.email.padEnd(35)} pw: ${u.role === 'ADMIN' ? 'Admin123!' : 'Password123!'}`)
    );
    console.log('\n   Storages:', storages.map(s => s.name).join(' | '));
    console.log('');
  } catch (error) {
    console.error('\n❌  Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
