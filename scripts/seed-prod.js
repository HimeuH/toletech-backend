/**
 * Production seeder — additive and idempotent, never deletes anything
 * (unlike utils/seed.mongo.js, which wipes every collection: dev only).
 *
 * Steps (pass one or more):
 *   --staff   real ADMIN / AGENT accounts from scripts/prod-staff.json
 *             (gitignored; copy prod-staff.example.json). Each gets a random
 *             password, printed once, and must change it on first login.
 *   --config  default CommissionConfig rules + ProductType list.
 *   --demo    onboarding demo data (owners, farmers, transporter, storages,
 *             reservations, one billing). All demo users use the
 *             @demo.toletech.sn email domain → removed by scripts/purge-demo.js.
 *   --yes     skip the "type the db name" confirmation.
 *
 * Usage:
 *   MONGO_URI="mongodb+srv://.../toletech?..." node scripts/seed-prod.js --staff --config --demo
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { User, Storage, Reservation, Billing } = require('../models');
const CommissionConfig = require('../models/CommissionConfig');
const ProductType = require('../models/ProductType');
const { DEFAULT_PRODUCTS } = require('../controllers/productType.controller');
const { DEMO_EMAIL_DOMAIN, DEMO_EMAIL_REGEX, connectAndConfirm } = require('./_prodDb');

const STAFF_FILE = path.join(__dirname, 'prod-staff.json');
const STAFF_ROLES = ['ADMIN', 'AGENT'];

// Defaults only — admins adjust them afterwards from the commission screen.
const DEFAULT_COMMISSIONS = [
  { transactionType: 'STORAGE',   mode: 'PERCENTAGE', value: 10 },
  { transactionType: 'TRANSPORT', mode: 'PERCENTAGE', value: 15 }
];

const randomPassword = () => `Tt-${crypto.randomBytes(9).toString('base64url')}`;

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ── --staff ─────────────────────────────────────────────────────────────────
const seedStaff = async () => {
  if (!fs.existsSync(STAFF_FILE)) {
    throw new Error(`${STAFF_FILE} not found — copy prod-staff.example.json and fill in the real staff`);
  }
  const staff = JSON.parse(fs.readFileSync(STAFF_FILE, 'utf8'));

  console.log('── Staff ───────────────────────────────────────────────');
  for (const s of staff) {
    if (!s.name || !s.email || !s.phone) throw new Error(`Staff entry needs name, email, phone: ${JSON.stringify(s)}`);
    if (!s.roles?.length || s.roles.some((r) => !STAFF_ROLES.includes(r))) {
      throw new Error(`Staff roles must be within ${STAFF_ROLES.join('/')}: ${s.email}`);
    }
    if (DEMO_EMAIL_REGEX.test(s.email)) throw new Error(`Staff cannot use the demo domain: ${s.email}`);

    const existing = await User.findOne({ $or: [{ email: s.email.toLowerCase() }, { phone: s.phone }] });
    if (existing) {
      console.log(`  skip     ${s.email} (email or phone already exists)`);
      continue;
    }

    const password = randomPassword();
    await User.create({
      ...s,
      password,
      isActive: true,
      isVerified: true,
      mustChangePassword: true
    });
    console.log(`  created  ${s.roles.join(',').padEnd(8)} ${s.email.padEnd(36)} pw: ${password}`);
  }
  console.log('  → Share each password privately; it is not stored anywhere else.\n');
};

// ── --config ────────────────────────────────────────────────────────────────
const seedConfig = async () => {
  console.log('── Config ──────────────────────────────────────────────');
  for (const c of DEFAULT_COMMISSIONS) {
    const exists = await CommissionConfig.findOne({
      transactionType: c.transactionType,
      partnerId: null,
      storageId: null
    });
    if (exists) {
      console.log(`  skip     commission ${c.transactionType} (already ${exists.value}${exists.mode === 'PERCENTAGE' ? '%' : ' XOF'})`);
      continue;
    }
    await CommissionConfig.create({ ...c, currency: 'XOF' });
    console.log(`  created  commission ${c.transactionType} ${c.value}%`);
  }

  let created = 0;
  for (const p of DEFAULT_PRODUCTS) {
    const res = await ProductType.updateOne({ name: p.name }, { $setOnInsert: p }, { upsert: true });
    created += res.upsertedCount;
  }
  console.log(`  products ${created} created, ${DEFAULT_PRODUCTS.length - created} already present`);
  console.log('  (payment providers & platform settings self-seed on first admin visit)\n');
};

// ── --demo ──────────────────────────────────────────────────────────────────
const seedDemo = async () => {
  console.log('── Demo ────────────────────────────────────────────────');
  const existing = await User.countDocuments({ email: DEMO_EMAIL_REGEX });
  if (existing) {
    console.log(`  skip     ${existing} demo user(s) already exist — run purge-demo.js first to reseed\n`);
    return;
  }

  const password = randomPassword();
  const demoUser = (u) => ({
    ...u,
    email: `${u.email}@${DEMO_EMAIL_DOMAIN}`,
    password,
    isActive: true,
    isVerified: true,
    // Fake numbers: never let a notification SMS/WhatsApp reach whoever owns them.
    notifPrefs: { sms: false, whatsapp: false, push: true }
  });

  const [owner1, owner2, farmer1, farmer2, transporter] = await User.create([
    demoUser({
      name: 'DEMO – Awa Ndiaye',
      email: 'awa.ndiaye',
      phone: '+221700009001',
      roles: ['PROPRIETAIRE'],
      location: 'Diamniadio',
      companyName: 'DEMO – Froid Diamniadio SARL',
      contactPerson: 'Awa Ndiaye'
    }),
    demoUser({
      name: 'DEMO – Serigne Mbaye',
      email: 'serigne.mbaye',
      phone: '+221700009002',
      roles: ['PROPRIETAIRE'],
      location: 'Kaolack',
      companyName: 'DEMO – Entrepôts du Saloum',
      contactPerson: 'Serigne Mbaye'
    }),
    demoUser({
      name: 'DEMO – Moussa Diop',
      email: 'moussa.diop',
      phone: '+221700009003',
      roles: ['AGRICULTEUR'],
      location: 'Thiès',
      exploitationType: 'Maraîchage',
      crops: ['Oignon', 'Pomme de terre', 'Tomate']
    }),
    demoUser({
      name: 'DEMO – Mariama Cissé',
      email: 'mariama.cisse',
      phone: '+221700009004',
      roles: ['AGRICULTEUR'],
      location: 'Rufisque',
      exploitationType: 'Maraîchage',
      crops: ['Tomate', 'Mangue', 'Gombo']
    }),
    demoUser({
      name: 'DEMO – Pape Ndiaye',
      email: 'pape.ndiaye',
      phone: '+221700009005',
      roles: ['TRANSPORTEUR'],
      location: 'Thiès',
      vehicleType: 'Camion 10T',
      vehicleCapacity: 10,
      vehiclePlate: 'TH-0000-DM',
      serviceZones: ['Thiès', 'Dakar', 'Diamniadio'],
      isAvailableForTransport: true,
      transportPricing: {
        mode: 'BOTH',
        perKmRate: 350,
        fixedRoutes: [
          { from: 'Thiès', to: 'Diamniadio', price: 25000 },
          { from: 'Tivaouane', to: 'Diamniadio', price: 35000 }
        ]
      }
    })
  ]);

  const [coldRoom, onionStore, hangar] = await Storage.create([
    {
      owner: owner1._id,
      createdBy: owner1._id,
      name: 'DEMO – Chambre froide Diamniadio',
      storageType: 'CHAMBRE_FROIDE',
      location: 'Diamniadio',
      address: { street: 'Zone industrielle', city: 'Diamniadio', region: 'Dakar', country: 'Sénégal' },
      gpsCoordinates: { type: 'Point', coordinates: [-17.1915, 14.727] },
      description: 'Chambre froide 2°C–8°C pour fruits et légumes. Quai de chargement, groupe électrogène de secours.',
      facilities: ['electricity', 'security', 'temperature_control', 'loading_dock'],
      accessHours: 'Lun-Sam 07h-19h',
      capacity: 60,
      capacityUnit: 'TONNES',
      availableFrom: daysFromNow(-7),
      availableTo: daysFromNow(180),
      costPerKgPerDay: 10,
      acceptedProducts: ['Oignon', 'Tomate', 'Pomme de terre', 'Mangue'],
      isAvailable: true
    },
    {
      owner: owner1._id,
      createdBy: owner1._id,
      name: 'DEMO – Magasin oignons Diamniadio',
      storageType: 'HANGAR',
      location: 'Diamniadio',
      address: { street: 'Route de Bargny', city: 'Diamniadio', region: 'Dakar', country: 'Sénégal' },
      gpsCoordinates: { type: 'Point', coordinates: [-17.1985, 14.7195] },
      description: 'Magasin ventilé sur claies pour oignons et pommes de terre. Gardiennage 24h/24.',
      facilities: ['ventilation', 'security', 'loading_dock'],
      accessHours: '24h/24 – 7j/7',
      capacity: 150,
      capacityUnit: 'TONNES',
      availableFrom: daysFromNow(-30),
      availableTo: daysFromNow(240),
      costPerKgPerDay: 4,
      acceptedProducts: ['Oignon', 'Pomme de terre'],
      isAvailable: true,
      reservedCapacity: 10 // R3 below is CONFIRMÉ
    },
    {
      owner: owner2._id,
      createdBy: owner2._id,
      name: 'DEMO – Hangar arachide Kaolack',
      storageType: 'HANGAR',
      location: 'Kaolack',
      address: { street: 'Avenue Valdiodio Ndiaye', city: 'Kaolack', region: 'Kaolack', country: 'Sénégal' },
      gpsCoordinates: { type: 'Point', coordinates: [-16.0726, 14.1522] },
      description: 'Hangar sec pour arachide, mil et niébé. Proche du marché central.',
      facilities: ['security', 'loading_dock'],
      accessHours: 'Lun-Sam 07h-18h',
      capacity: 400,
      capacityUnit: 'TONNES',
      availableFrom: daysFromNow(-15),
      availableTo: daysFromNow(150),
      costPerKgPerDay: 3,
      acceptedProducts: ['Arachide', 'Mil', 'Niébé', 'Sésame'],
      isAvailable: true
    }
  ]);

  const history = (...steps) =>
    steps.map(([status, by, day, message]) => ({ status, changedBy: by._id, changedAt: daysFromNow(day), message }));

  // R1 — EN_ATTENTE: the owner approves it live during the session
  await Reservation.create({
    user: farmer1._id,
    createdBy: farmer1._id,
    storage: coldRoom._id,
    product: 'Oignon',
    quantity: 3,
    quantityUnit: 'TONNES',
    reservedFrom: daysFromNow(3),
    reservedTo: daysFromNow(33),
    status: 'EN_ATTENTE',
    notes: 'Oignons récoltés à Thiès, en sacs de 25 kg.',
    statusHistory: history(['EN_ATTENTE', farmer1, -1, 'Réservation initiale'])
  });

  // R2 — APPROUVÉ, awaiting confirmation
  await Reservation.create({
    user: farmer2._id,
    createdBy: farmer2._id,
    storage: coldRoom._id,
    product: 'Tomate',
    quantity: 1500,
    quantityUnit: 'KG',
    reservedFrom: daysFromNow(2),
    reservedTo: daysFromNow(16),
    status: 'APPROUVÉ',
    notes: 'Tomates fraîches, caisses plastiques.',
    ownerMessage: 'Place disponible en zone B.',
    statusHistory: history(
      ['EN_ATTENTE', farmer2, -3, 'Réservation initiale'],
      ['APPROUVÉ', owner1, -2, 'Capacité disponible']
    )
  });

  // R3 — CONFIRMÉ with accepted transport + pending billing
  const r3From = daysFromNow(-5);
  const r3To = daysFromNow(25);
  const r3 = await Reservation.create({
    user: farmer1._id,
    createdBy: farmer1._id,
    storage: onionStore._id,
    product: 'Oignon',
    quantity: 10,
    quantityUnit: 'TONNES',
    reservedFrom: r3From,
    reservedTo: r3To,
    status: 'CONFIRMÉ',
    notes: '10 tonnes d’oignons, campagne 2026.',
    ownerMessage: 'Réservation confirmée. Livraison acceptée à partir de 8h.',
    needsTransport: true,
    pickupLocation: 'Thiès',
    transporter: transporter._id,
    proposedTransportFee: 25000,
    transportFee: 25000,
    transportStatus: 'ACCEPTÉ',
    transportRequestedAt: daysFromNow(-8),
    transportAcceptedAt: daysFromNow(-7),
    statusHistory: history(
      ['EN_ATTENTE', farmer1, -10, 'Réservation initiale'],
      ['APPROUVÉ', owner1, -9, 'Dossier complet'],
      ['CONFIRMÉ', owner1, -8, 'Réservation confirmée']
    )
  });

  const r3Days = Math.max(1, Math.ceil((r3To - r3From) / (1000 * 60 * 60 * 24)));
  const r3StorageAmount = r3Days * onionStore.costPerKgPerDay * 10000; // 10 t = 10 000 kg
  await Billing.create({
    reservation: r3._id,
    user: farmer1._id,
    storage: onionStore._id,
    days: r3Days,
    storageAmount: r3StorageAmount,
    transportAmount: 25000,
    totalAmount: r3StorageAmount + 25000,
    status: 'PENDING',
    currency: 'XOF'
  });

  // R4 — REJETÉ
  await Reservation.create({
    user: farmer2._id,
    createdBy: farmer2._id,
    storage: hangar._id,
    product: 'Arachide',
    quantity: 500,
    quantityUnit: 'TONNES',
    reservedFrom: daysFromNow(-12),
    reservedTo: daysFromNow(18),
    status: 'REJETÉ',
    ownerMessage: 'Capacité insuffisante sur cette période.',
    statusHistory: history(
      ['EN_ATTENTE', farmer2, -14, 'Réservation initiale'],
      ['REJETÉ', owner2, -13, 'Capacité insuffisante']
    )
  });

  console.log(`  users    5 (password for all: ${password})`);
  [owner1, owner2, farmer1, farmer2, transporter].forEach((u) =>
    console.log(`           ${u.roles[0].padEnd(13)} ${u.email.padEnd(34)} ${u.phone}`)
  );
  console.log('  storages 3 · reservations 4 (EN_ATTENTE, APPROUVÉ, CONFIRMÉ+transport, REJETÉ) · billing 1 PENDING');
  console.log('  → Do not pay the demo billing; remove everything with scripts/purge-demo.js\n');
};

const main = async () => {
  const args = process.argv.slice(2);
  const steps = ['--staff', '--config', '--demo'].filter((s) => args.includes(s));
  if (!steps.length) {
    console.log('Usage: node scripts/seed-prod.js [--staff] [--config] [--demo] [--yes]');
    return;
  }

  try {
    await connectAndConfirm(`seed ${steps.join(' ')}`);
    if (steps.includes('--staff')) await seedStaff();
    if (steps.includes('--config')) await seedConfig();
    if (steps.includes('--demo')) await seedDemo();
    console.log('✅  Done');
  } catch (error) {
    console.error('\n❌ ', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
