const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./db');
const { User, Storage, Reservation, Billing, Otp } = require('../models');
const CommissionConfig = require('../models/CommissionConfig');
const PaymentProviderConfig = require('../models/PaymentProviderConfig');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

dotenv.config({ path: './config/config.env' });

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const calcDays = (from, to) =>
  Math.max(1, Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)));

const main = async () => {
  try {
    await connectDB();

    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Storage.deleteMany({}),
      Reservation.deleteMany({}),
      Billing.deleteMany({}),
      Otp.deleteMany({}),
      Wallet.deleteMany({}),
      Transaction.deleteMany({}),
      CommissionConfig.deleteMany({}),
      PaymentProviderConfig.deleteMany({})
    ]);

    // ── Users ──────────────────────────────────────────────────────────────────
    const users = await User.create([
      // ── ADMIN
      {
        name: 'Ibrahima Ndiaye',
        email: 'admin@toletech.com',
        password: 'Admin123!',
        phone: '+221770000000',
        roles: ['ADMIN'],
        location: 'Dakar',
        isActive: true,
        isVerified: true
      },

      // ── AGENTS
      {
        name: 'Cheikh Ba',
        email: 'cheikh.ba@agent.toletech.com',
        password: 'Password123!',
        phone: '+221771000001',
        roles: ['AGENT'],
        location: 'Thiès',
        assignedRegion: 'Thiès',
        identificationNumber: 'AGT-TH-001',
        isActive: true,
        isVerified: true
      },
      {
        name: 'Alioune Kane',
        email: 'alioune.kane@agent.toletech.com',
        password: 'Password123!',
        phone: '+221771000002', roles: ['AGENT'],
        location: 'Kaolack',
        assignedRegion: 'Kaolack',
        identificationNumber: 'AGT-KL-001',
        isActive: true,
        isVerified: true
      },

      // ── PROPRIETAIRES
      {
        name: 'Awa Ndiaye',
        email: 'awa.ndiaye@example.com',
        password: 'Password123!',
        phone: '+221772000001',
        roles: ['PROPRIETAIRE'],
        location: 'Dakar',
        companyName: 'Grenier Ndiaye & Fils',
        companyRegistration: 'SN-DKR-2019-1142',
        contactPerson: 'Awa Ndiaye',
        payoutFrequencyDays: 15,
        isActive: true,
        isVerified: true
      },
      {
        name: 'Serigne Mbaye',
        email: 'serigne.mbaye@example.com',
        password: 'Password123!',
        phone: '+221772000002',
        roles: ['PROPRIETAIRE'],
        location: 'Kaolack',
        companyName: 'Entrepôts du Sine-Saloum',
        companyRegistration: 'SN-KL-2020-0378',
        contactPerson: 'Serigne Mbaye',
        payoutFrequencyDays: 15,
        isActive: true,
        isVerified: true
      },
      {
        name: 'Modou Fall',
        email: 'modou.fall@example.com',
        password: 'Password123!',
        phone: '+221772000003',
        roles: ['PROPRIETAIRE'],
        location: 'Saint-Louis',
        companyName: 'Silos du Fleuve',
        companyRegistration: 'SN-SL-2018-0055',
        contactPerson: 'Modou Fall',
        payoutFrequencyDays: 15,
        isActive: true,
        isVerified: true
      },

      // ── TRANSFORMATEURS
      {
        name: 'Fatou Seck',
        email: 'fatou.seck@example.com',
        password: 'Password123!',
        phone: '+221773000001',
        roles: ['TRANSFORMATEUR'],
        location: 'Thiès',
        companyName: 'Seck Agro Transform',
        companyRegistration: 'SN-TH-2021-0890',
        contactPerson: 'Fatou Seck',
        payoutFrequencyDays: 15,
        isActive: true,
        isVerified: true
      },
      {
        name: 'Aminata Diouf',
        email: 'aminata.diouf@example.com',
        password: 'Password123!',
        phone: '+221773000002',
        roles: ['TRANSFORMATEUR'],
        location: 'Ziguinchor',
        companyName: 'Casamance Froid & Stockage',
        companyRegistration: 'SN-ZG-2022-0214',
        contactPerson: 'Aminata Diouf',
        payoutFrequencyDays: 15,
        isActive: true,
        isVerified: true
      },

      // ── TRANSPORTEURS
      {
        name: 'Pape Ndiaye',
        email: 'pape.ndiaye@transporteur.com',
        password: 'Password123!',
        phone: '+221775000001',
        roles: ['TRANSPORTEUR'],
        location: 'Dakar',
        vehicleType: 'Camion 10T',
        vehicleCapacity: 10,
        vehiclePlate: 'DK-1234-AB',
        serviceZones: ['Dakar', 'Thiès', 'Kaolack'],
        isAvailableForTransport: true,
        payoutFrequencyDays: 15,
        isActive: true,
        isVerified: true
      },
      {
        name: 'Bineta Diallo',
        email: 'bineta.diallo@transporteur.com',
        password: 'Password123!',
        phone: '+221775000002',
        roles: ['TRANSPORTEUR'],
        location: 'Kaolack',
        vehicleType: 'Camionnette 3T',
        vehicleCapacity: 3,
        vehiclePlate: 'KL-5678-CD',
        serviceZones: ['Kaolack', 'Fatick', 'Ziguinchor'],
        isAvailableForTransport: true,
        payoutFrequencyDays: 15,
        isActive: true,
        isVerified: true
      },

      // ── AGRICULTEURS
      {
        name: 'Moussa Diop',
        email: 'moussa.diop@example.com',
        password: 'Password123!',
        phone: '+221774000001',
        roles: ['AGRICULTEUR'],
        location: 'Kaolack',
        exploitationType: 'Grandes cultures',
        crops: ['Mil', 'Maïs', 'Arachide', 'Niébé'],
        isActive: true,
        isVerified: true
      },
      {
        name: 'Ibou Fall',
        email: 'ibou.fall@example.com',
        password: 'Password123!',
        phone: '+221774000002',
        roles: ['AGRICULTEUR'],
        location: 'Ziguinchor',
        exploitationType: 'Maraîchage et riziculture',
        crops: ['Riz', 'Tomate', 'Oignon', 'Gombo'],
        isActive: true,
        isVerified: true
      },
      {
        name: 'Pape Gaye',
        email: 'pape.gaye@example.com',
        password: 'Password123!',
        phone: '+221774000003',
        roles: ['AGRICULTEUR'],
        location: 'Thiès',
        exploitationType: 'Polyculture',
        crops: ['Arachide', 'Mil', 'Sorgho'],
        isActive: true,
        isVerified: true
      },
      {
        name: 'Ndéye Sarr',
        email: 'ndeye.sarr@example.com',
        password: 'Password123!',
        phone: '+221774000004',
        roles: ['AGRICULTEUR'],
        location: 'Diourbel',
        exploitationType: 'Oléagineux',
        crops: ['Arachide', 'Sésame', 'Niébé'],
        isActive: true,
        isVerified: true
      },
      {
        name: 'Ousmane Ba',
        email: 'ousmane.ba@example.com',
        password: 'Password123!',
        phone: '+221774000005',
        roles: ['AGRICULTEUR'],
        location: 'Saint-Louis',
        exploitationType: 'Riziculture irriguée',
        crops: ['Riz', 'Tomate', 'Oignon'],
        isActive: true,
        isVerified: true
      },
      {
        name: 'Mariama Cissé',
        email: 'mariama.cisse@example.com',
        password: 'Password123!',
        phone: '+221774000006',
        roles: ['AGRICULTEUR'],
        location: 'Fatick',
        exploitationType: 'Maraîchage',
        crops: ['Oignon', 'Bissap', 'Pastèque', 'Piment'],
        isActive: true,
        isVerified: true
      }
    ]);

    const admin       = users.find(u => u.roles?.includes('ADMIN'));
    const agent1      = users.find(u => u.email === 'cheikh.ba@agent.toletech.com');
    const owner1      = users.find(u => u.email === 'awa.ndiaye@example.com');
    const owner2      = users.find(u => u.email === 'serigne.mbaye@example.com');
    const owner3      = users.find(u => u.email === 'modou.fall@example.com');
    const trans1      = users.find(u => u.email === 'fatou.seck@example.com');
    const trans2      = users.find(u => u.email === 'aminata.diouf@example.com');
    const transport1  = users.find(u => u.email === 'pape.ndiaye@transporteur.com');
    const farmer1     = users.find(u => u.email === 'moussa.diop@example.com');
    const farmer2     = users.find(u => u.email === 'ibou.fall@example.com');
    const farmer3     = users.find(u => u.email === 'pape.gaye@example.com');
    const farmer4     = users.find(u => u.email === 'ndeye.sarr@example.com');
    const farmer5     = users.find(u => u.email === 'ousmane.ba@example.com');
    const farmer6     = users.find(u => u.email === 'mariama.cisse@example.com');

    // ── Storages ────────────────────────────────────────────────────────────────
    const storages = await Storage.create([
      // 0 — Silo Rufisque (owner1)
      {
        owner: owner1._id,
        createdBy: owner1._id,
        name: 'Silo Rufisque',
        storageType: 'SILO',
        location: 'Rufisque, Dakar',
        address: { street: 'Route de Bargny', city: 'Rufisque', region: 'Dakar', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-17.2742, 14.7167] },
        description: 'Grand silo métallique pour céréales sèches, accès 24h/24, gardiennage permanent.',
        facilities: ['electricity', 'security', 'ventilation', 'loading_dock'],
        accessHours: '24h/24 – 7j/7',
        capacity: 1500,
        capacityUnit: 'TONNES',
        availableFrom: daysFromNow(-30),
        availableTo: daysFromNow(180),
        costPerKgPerDay: 8,
        productType: 'Céréales (mil, maïs, sorgho)',
        isAvailable: true
      },
      // 1 — Hangar Kaolack (owner2)
      {
        owner: owner2._id,
        createdBy: owner2._id,
        name: 'Hangar Arachide Kaolack',
        storageType: 'HANGAR',
        location: 'Kaolack Centre',
        address: { street: 'Avenue Valdiodio Ndiaye', city: 'Kaolack', region: 'Kaolack', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-16.0726, 14.1522] },
        description: 'Hangar spacieux dédié aux arachides et légumineuses. Proximité du marché central de Kaolack.',
        facilities: ['security', 'loading_dock'],
        accessHours: 'Lun-Sam 07h-19h',
        capacity: 800,
        capacityUnit: 'TONNES',
        availableFrom: daysFromNow(-15),
        availableTo: daysFromNow(120),
        costPerKgPerDay: 12,
        productType: 'Arachide, niébé, sésame',
        isAvailable: true
      },
      // 2 — Silo Saint-Louis (owner3)
      {
        owner: owner3._id,
        createdBy: owner3._id,
        name: 'Silos du Fleuve – Saint-Louis',
        storageType: 'SILO',
        location: 'Saint-Louis Nord',
        address: { street: 'Route de Rosso', city: 'Saint-Louis', region: 'Saint-Louis', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-16.4896, 16.0179] },
        description: 'Complexe de silos pour le riz irrigué de la vallée du fleuve Sénégal. Accès camions 16T.',
        facilities: ['electricity', 'security', 'ventilation', 'loading_dock', 'weighbridge'],
        accessHours: 'Lun-Ven 06h-20h, Sam 07h-14h',
        capacity: 2000,
        capacityUnit: 'TONNES',
        availableFrom: daysFromNow(-60),
        availableTo: daysFromNow(240),
        costPerKgPerDay: 9,
        productType: 'Riz paddy, riz blanchi',
        isAvailable: true
      },
      // 3 — Chambre Froide Thiès (trans1)
      {
        owner: trans1._id,
        createdBy: trans1._id,
        name: 'Chambre Froide Thiès',
        storageType: 'CHAMBRE_FROIDE',
        location: 'Thiès Centre',
        address: { street: 'Rue 12 – Zone Industrielle', city: 'Thiès', region: 'Thiès', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-16.9300, 14.7910] },
        description: 'Chambre froide industrielle pour fruits, légumes, produits laitiers et fleurs. Température entre 2°C et 8°C.',
        facilities: ['electricity', 'ventilation', 'security', 'temperature_control'],
        accessHours: 'Lun-Ven 06h-20h',
        capacity: 300,
        capacityUnit: 'M3',
        availableFrom: daysFromNow(-20),
        availableTo: daysFromNow(90),
        costPerKgPerDay: 28,
        productType: 'Légumes, fruits, produits laitiers',
        isAvailable: true
      },
      // 4 — Hangar Ziguinchor (trans2)
      {
        owner: trans2._id,
        createdBy: trans2._id,
        name: 'Hangar Casamance – Ziguinchor',
        storageType: 'HANGAR',
        location: 'Ziguinchor Sud',
        address: { street: 'Route de Kolda', city: 'Ziguinchor', region: 'Ziguinchor', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-16.2738, 12.5627] },
        description: 'Hangar ventilé pour riz de Casamance, cajou et huile de palme. Proche du port de Ziguinchor.',
        facilities: ['ventilation', 'security', 'loading_dock'],
        accessHours: 'Tous les jours 06h-18h',
        capacity: 600,
        capacityUnit: 'TONNES',
        availableFrom: daysFromNow(-10),
        availableTo: daysFromNow(150),
        costPerKgPerDay: 11,
        productType: 'Riz, cajou, huile de palme',
        isAvailable: true
      },
      // 5 — Chambre Froide Dakar (owner1)
      {
        owner: owner1._id,
        createdBy: owner1._id,
        name: 'Entrepôt Frigorifique Dakar-Yoff',
        storageType: 'CHAMBRE_FROIDE',
        location: 'Yoff, Dakar',
        address: { street: 'Route de l\'Aéroport LSS', city: 'Dakar', region: 'Dakar', country: 'Sénégal' },
        gpsCoordinates: { type: 'Point', coordinates: [-17.4900, 14.7300] },
        description: 'Entrepôt frigorifique multi-températures (0°C à 12°C). Idéal pour produits de la pêche, légumes et fruits d\'exportation.',
        facilities: ['electricity', 'ventilation', 'security', 'temperature_control', 'loading_dock'],
        accessHours: '24h/24 – 7j/7',
        capacity: 250,
        capacityUnit: 'M3',
        availableFrom: daysFromNow(-5),
        availableTo: daysFromNow(120),
        costPerKgPerDay: 35,
        productType: 'Poisson, légumes, fruits d\'exportation',
        isAvailable: true
      }
    ]);

    // ── Reservations ────────────────────────────────────────────────────────────
    // R1 — farmer1 → Silo Rufisque — CONFIRMÉ (billing PAID)
    const r1From = daysFromNow(-25);
    const r1To   = daysFromNow(-5);
    const res1 = await Reservation.create({
      user: farmer1._id,
      createdBy: farmer1._id,
      storage: storages[0]._id,
      reservedFrom: r1From,
      reservedTo: r1To,
      status: 'CONFIRMÉ',
      quantity: 120,
      quantityUnit: 'TONNES',
      notes: '120 tonnes de maïs sec récolte 2025. Sacs de 100 kg chacun.',
      ownerMessage: 'Réservation approuvée. Merci de vous présenter avec le bon de dépôt.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer1._id, changedAt: daysFromNow(-30), message: 'Réservation initiale' },
        { status: 'APPROUVÉ',   changedBy: owner1._id,  changedAt: daysFromNow(-28), message: 'Dossier complet, capacité disponible' },
        { status: 'CONFIRMÉ',   changedBy: admin._id,   changedAt: daysFromNow(-26), message: 'Paiement reçu, confirmation définitive' }
      ]
    });

    // R2 — farmer2 → Hangar Kaolack — APPROUVÉ (no billing yet)
    const r2From = daysFromNow(3);
    const r2To   = daysFromNow(33);
    await Reservation.create({
      user: farmer2._id,
      createdBy: farmer2._id,
      storage: storages[1]._id,
      reservedFrom: r2From,
      reservedTo: r2To,
      status: 'APPROUVÉ',
      quantity: 80,
      quantityUnit: 'TONNES',
      notes: '80 tonnes d\'arachides décortiquées, prêtes pour le marché.',
      ownerMessage: 'Bienvenue. Zone Lot 2 réservée pour vous.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer2._id, changedAt: daysFromNow(-5), message: 'Réservation initiale' },
        { status: 'APPROUVÉ',   changedBy: owner2._id,  changedAt: daysFromNow(-3), message: 'OK, place disponible' }
      ]
    });

    // R3 — farmer3 → Chambre Froide Thiès — EN_ATTENTE
    const r3From = daysFromNow(7);
    const r3To   = daysFromNow(22);
    await Reservation.create({
      user: farmer3._id,
      createdBy: farmer3._id,
      storage: storages[3]._id,
      reservedFrom: r3From,
      reservedTo: r3To,
      status: 'EN_ATTENTE',
      quantity: 5000,
      quantityUnit: 'KG',
      notes: '5 tonnes d\'oignons cultivés à Thiès. Besoin de température entre 4°C et 6°C.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer3._id, changedAt: daysFromNow(-1), message: 'Réservation initiale' }
      ]
    });

    // R4 — farmer5 → Silos Saint-Louis — CONFIRMÉ (billing PENDING, for Wave testing)
    const r4From = daysFromNow(1);
    const r4To   = daysFromNow(31);
    const res4 = await Reservation.create({
      user: farmer5._id,
      createdBy: farmer5._id,
      storage: storages[2]._id,
      reservedFrom: r4From,
      reservedTo: r4To,
      status: 'CONFIRMÉ',
      quantity: 200,
      quantityUnit: 'TONNES',
      notes: '200 tonnes de riz paddy issu de la campagne d\'hivernage 2025, Podor.',
      ownerMessage: 'Silo 1 réservé. Apporter certificat de qualité.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer5._id,  changedAt: daysFromNow(-12), message: 'Demande de stockage saison hivernage' },
        { status: 'APPROUVÉ',   changedBy: owner3._id,   changedAt: daysFromNow(-10), message: 'Capacité vérifiée, documents en règle' },
        { status: 'CONFIRMÉ',   changedBy: owner3._id,   changedAt: daysFromNow(-8),  message: 'Contrat signé' }
      ]
    });

    // R5 — farmer4 → Hangar Kaolack — REJETÉ
    await Reservation.create({
      user: farmer4._id,
      createdBy: farmer4._id,
      storage: storages[1]._id,
      reservedFrom: daysFromNow(-20),
      reservedTo: daysFromNow(-5),
      status: 'REJETÉ',
      quantity: 300,
      quantityUnit: 'TONNES',
      notes: '300 tonnes de sésame. Besoin urgent.',
      ownerMessage: 'Désolé, capacité insuffisante pour la période demandée. Réessayez après le 15 du mois.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer4._id, changedAt: daysFromNow(-22), message: 'Réservation initiale' },
        { status: 'REJETÉ',     changedBy: owner2._id,  changedAt: daysFromNow(-21), message: 'Capacité insuffisante pour cette période' }
      ]
    });

    // R6 — farmer6 → Entrepôt Frigorifique Dakar — ANNULÉ
    await Reservation.create({
      user: farmer6._id,
      createdBy: farmer6._id,
      storage: storages[5]._id,
      reservedFrom: daysFromNow(10),
      reservedTo: daysFromNow(25),
      status: 'ANNULÉ',
      quantity: 2000,
      quantityUnit: 'KG',
      notes: 'Oignons et piments de Fatick.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer6._id, changedAt: daysFromNow(-8), message: 'Réservation initiale' },
        { status: 'ANNULÉ',     changedBy: farmer6._id, changedAt: daysFromNow(-6), message: 'Annulation suite à un accord direct avec un acheteur local' }
      ]
    });

    // R7 — farmer1 → Hangar Ziguinchor — EN_ATTENTE (agent proxy)
    await Reservation.create({
      user: farmer1._id,
      createdBy: agent1._id,
      storage: storages[4]._id,
      reservedFrom: daysFromNow(14),
      reservedTo: daysFromNow(44),
      status: 'EN_ATTENTE',
      quantity: 50,
      quantityUnit: 'TONNES',
      notes: 'Niébé et mil. Réservation effectuée par l\'agent Cheikh Ba pour le compte de M. Moussa Diop.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: agent1._id, changedAt: daysFromNow(-2), message: 'Réservation par proxy agent' }
      ]
    });

    // R8 — farmer2 → Silos Saint-Louis — CONFIRMÉ (billing PAID)
    const r8From = daysFromNow(-45);
    const r8To   = daysFromNow(-15);
    const res8 = await Reservation.create({
      user: farmer2._id,
      createdBy: farmer2._id,
      storage: storages[2]._id,
      reservedFrom: r8From,
      reservedTo: r8To,
      status: 'CONFIRMÉ',
      quantity: 60,
      quantityUnit: 'TONNES',
      notes: '60 tonnes de riz de Casamance stockées temporairement à Saint-Louis avant livraison.',
      ownerMessage: 'Bon de dépôt émis. Silo 2 attribué.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer2._id, changedAt: daysFromNow(-50), message: 'Réservation initiale' },
        { status: 'APPROUVÉ',   changedBy: owner3._id,  changedAt: daysFromNow(-48), message: 'Documents reçus, capacité disponible' },
        { status: 'CONFIRMÉ',   changedBy: owner3._id,  changedAt: daysFromNow(-46), message: 'Paiement validé' }
      ]
    });

    // R9 — farmer1 → Chambre Froide Thiès — CONFIRMÉ (small billing PENDING — Wave test)
    const r9From = daysFromNow(-2);
    const r9To   = daysFromNow(5);
    const res9 = await Reservation.create({
      user: farmer1._id,
      createdBy: farmer1._id,
      storage: storages[3]._id,
      reservedFrom: r9From,
      reservedTo: r9To,
      status: 'CONFIRMÉ',
      quantity: 100,
      quantityUnit: 'KG',
      notes: '100 kg d\'oignons en attente de paiement. Facture test Wave.',
      ownerMessage: 'Place réservée en zone B.',
      statusHistory: [
        { status: 'EN_ATTENTE', changedBy: farmer1._id, changedAt: daysFromNow(-4), message: 'Réservation initiale' },
        { status: 'APPROUVÉ',   changedBy: trans1._id,  changedAt: daysFromNow(-3), message: 'Capacité disponible' },
        { status: 'CONFIRMÉ',   changedBy: admin._id,   changedAt: daysFromNow(-2), message: 'Confirmé' }
      ]
    });

    // ── Billings ────────────────────────────────────────────────────────────────
    const r1Days = calcDays(r1From, r1To);
    await Billing.create({
      reservation: res1._id,
      user: farmer1._id,
      storage: storages[0]._id,
      totalAmount: r1Days * storages[0].costPerKgPerDay * 120000,
      days: r1Days,
      status: 'PAID',
      paidAt: daysFromNow(-24),
      currency: 'XOF'
    });

    // R4 billing — PENDING (large, for realistic demo)
    const r4Days = calcDays(r4From, r4To);
    await Billing.create({
      reservation: res4._id,
      user: farmer5._id,
      storage: storages[2]._id,
      totalAmount: r4Days * storages[2].costPerKgPerDay * 200000,
      days: r4Days,
      status: 'PENDING',
      currency: 'XOF'
    });

    // R8 billing — PAID
    const r8Days = calcDays(r8From, r8To);
    await Billing.create({
      reservation: res8._id,
      user: farmer2._id,
      storage: storages[2]._id,
      totalAmount: r8Days * storages[2].costPerKgPerDay * 60000,
      days: r8Days,
      status: 'PAID',
      paidAt: daysFromNow(-44),
      currency: 'XOF'
    });

    // R9 billing — PENDING small amount (Wave sandbox test)
    const r9Days = calcDays(r9From, r9To);
    const r9Amount = r9Days * storages[3].costPerKgPerDay * 100; // 100 kg
    const billingTest = await Billing.create({
      reservation: res9._id,
      user: farmer1._id,
      storage: storages[3]._id,
      totalAmount: r9Amount,
      days: r9Days,
      status: 'PENDING',
      currency: 'XOF'
    });

    // ── Payment provider config ──────────────────────────────────────────────
    await PaymentProviderConfig.create([
      { provider: 'WAVE',         label: 'Wave',         isEnabled: true  },
      { provider: 'ORANGE_MONEY', label: 'Orange Money', isEnabled: false }
    ]);

    // ── Commission config ────────────────────────────────────────────────────
    await CommissionConfig.create([
      { transactionType: 'STORAGE',   mode: 'PERCENTAGE', value: 10, currency: 'XOF' },
      { transactionType: 'TRANSPORT', mode: 'PERCENTAGE', value: 15, currency: 'XOF' }
    ]);

    // ── Wallets & transactions ───────────────────────────────────────────────
    // owner1 (Awa Ndiaye) — 45 000 XOF pending payout
    const w1 = await Wallet.create({ user: owner1._id, balance: 45000, totalEarned: 108000, totalPaidOut: 63000, currency: 'XOF', lastPayoutAt: daysFromNow(-16) });
    await Transaction.create([
      { wallet: w1._id, type: 'ESCROW_RELEASE', amount: 72000, description: 'Paiement net stockage — R1', status: 'COMPLETED', processedAt: daysFromNow(-24) },
      { wallet: w1._id, type: 'COMMISSION',     amount: 8000,  description: 'Commission Toletech (10%) — R1', status: 'COMPLETED', processedAt: daysFromNow(-24) },
      { wallet: w1._id, type: 'PAYOUT',         amount: 63000, description: 'Virement automatique J+15', status: 'COMPLETED', processedAt: daysFromNow(-16), provider: 'WAVE' }
    ]);

    // owner3 (Modou Fall) — 72 000 XOF pending payout
    const w3 = await Wallet.create({ user: owner3._id, balance: 72000, totalEarned: 72000, totalPaidOut: 0, currency: 'XOF' });
    await Transaction.create([
      { wallet: w3._id, type: 'ESCROW_RELEASE', amount: 81000, description: 'Paiement net stockage — R8', status: 'COMPLETED', processedAt: daysFromNow(-44) },
      { wallet: w3._id, type: 'COMMISSION',     amount: 9000,  description: 'Commission Toletech (10%) — R8', status: 'COMPLETED', processedAt: daysFromNow(-44) }
    ]);

    // transport1 (Pape Ndiaye) — 18 000 XOF pending payout
    const wt1 = await Wallet.create({ user: transport1._id, balance: 18000, totalEarned: 18000, totalPaidOut: 0, currency: 'XOF' });
    await Transaction.create(
      { wallet: wt1._id, type: 'CREDIT', amount: 18000, description: 'Transport mission — livraison confirmée', status: 'COMPLETED', processedAt: daysFromNow(-10) }
    );

    // ── Summary ─────────────────────────────────────────────────────────────────
    console.log('\n✅  Seed complete\n');
    console.log('── Users (' + users.length + ') ──────────────────────────────────────────────────────');
    users.forEach(u =>
      console.log(`  ${(u.roles?.[0] ?? '').padEnd(15)} ${u.email.padEnd(42)} pw: ${u.roles?.includes('ADMIN') ? 'Admin123!' : 'Password123!'}`)
    );
    console.log('\n── Storages (' + storages.length + ') ────────────────────────────────────────────────');
    storages.forEach((s, i) =>
      console.log(`  [${i}] ${s.storageType.padEnd(14)} ${s.name}`)
    );
    console.log('\n── Reservations (9) — CONFIRMÉ(4) APPROUVÉ(1) EN_ATTENTE(2) REJETÉ(1) ANNULÉ(1)');
    console.log('── Billings (4)     — PAID(2) PENDING(2)');
    console.log(`\n🧪  Wave test billing: farmer1 (moussa.diop@example.com / Password123!)`);
    console.log(`    Billing ID: ${billingTest._id}  |  Amount: ${r9Amount} XOF  |  status: PENDING`);
    console.log('\n── PaymentProviderConfig: WAVE=enabled, ORANGE_MONEY=disabled');
    console.log('── CommissionConfig: STORAGE=10%, TRANSPORT=15%');
    console.log('── Wallets: owner1(45k) owner3(72k) transport1(18k)\n');
  } catch (error) {
    console.error('\n❌  Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();
