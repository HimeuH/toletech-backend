// Reservation lifecycle side effects shared by the owner approval
// (respondToReservation), the admin status change (updateReservation) and
// the APPROUVÉ → CONFIRMÉ migration script.
//
// Flow: EN_ATTENTE → CONFIRMÉ on owner approval. APPROUVÉ is legacy — kept in
// the enum for old data only, nothing new is set to it.
const Storage = require('../models/Storage');
const Billing = require('../models/Billing');
const User = require('../models/User');
const notify = require('./notify');
const { toStorageUnit } = require('./units');

// reservation.storage may be populated (respondToReservation) or a raw id.
const storageIdOf = (reservation) => reservation.storage?._id ?? reservation.storage;

const quantityInStorageUnit = async (reservation) => {
  const storage = await Storage.findById(storageIdOf(reservation)).select('capacity reservedCapacity capacityUnit');
  if (!storage) return { storage: null, converted: reservation.quantity };
  const converted = toStorageUnit(reservation.quantity, reservation.quantityUnit, storage.capacityUnit) ?? reservation.quantity;
  return { storage, converted };
};

// Returns an error message when confirming would exceed the storage's
// remaining capacity, null otherwise.
const checkCapacityForConfirm = async (reservation) => {
  if (!reservation.quantity) return null;
  const { storage, converted } = await quantityInStorageUnit(reservation);
  if (!storage) return null;
  const available = Math.max(0, (storage.capacity || 0) - (storage.reservedCapacity || 0));
  if (converted > available) {
    return `Capacité insuffisante. Disponible : ${available} ${storage.capacityUnit}, demandé : ${converted} ${storage.capacityUnit}`;
  }
  return null;
};

// Send a transport request to a transporter: DEMANDÉ + 48h expiry + notify.
// Shared by assignTransporter (farmer picks after confirmation) and
// confirmation (transporter pre-selected in the booking wizard).
const requestTransport = async (reservation, { transporterId, proposedTransportFee, pickupLocation, farmerName }) => {
  reservation.transporter = transporterId;
  reservation.needsTransport = true;
  reservation.proposedTransportFee = proposedTransportFee;
  reservation.transportStatus = 'DEMANDÉ';
  reservation.transportRequestedAt = new Date();
  reservation.transportExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h window
  if (pickupLocation) reservation.pickupLocation = pickupLocation;
  await reservation.save();

  const templates = require('./notificationTemplates');
  const tpl = templates.TRANSPORT_ASSIGNED({
    farmerName: farmerName || 'Un agriculteur',
    storageName: reservation.storage?.name || reservation.storage?.toString() || 'entrepôt',
    proposedFee: proposedTransportFee
  });

  await notify(
    transporterId,
    'TRANSPORT_ASSIGNED',
    tpl.title,
    tpl.inApp,
    { reservationId: reservation._id },
    { sms: true, smsText: tpl.sms, waText: tpl.whatsapp }
  ).catch(err => console.error('Notification error:', err.message));
};

// Everything that happens once a reservation becomes CONFIRMÉ: lock capacity,
// generate the billing, and send the wizard's pre-selected transport request.
// Call after the status has been saved as CONFIRMÉ.
const applyConfirmationEffects = async (reservation) => {
  if (reservation.quantity) {
    const { converted } = await quantityInStorageUnit(reservation);
    await Storage.findByIdAndUpdate(storageIdOf(reservation), { $inc: { reservedCapacity: converted } });
  }

  const existingBilling = await Billing.findOne({ reservation: reservation._id });
  if (!existingBilling) {
    const { generateBilling } = require('../controllers/billing.controller');
    await generateBilling(reservation._id);
  }

  // Without an estimated fee (or if the transporter went unavailable) the
  // farmer proposes one from the reservation page (assignTransporter).
  if (
    reservation.needsTransport &&
    reservation.transporter &&
    reservation.transportStatus === 'NONE' &&
    reservation.proposedTransportFee > 0
  ) {
    const transporterAvailable = await User.exists({
      _id: reservation.transporter,
      roles: 'TRANSPORTEUR',
      isAvailableForTransport: true
    });
    if (transporterAvailable) {
      const farmer = await User.findById(reservation.user).select('name');
      await requestTransport(reservation, {
        transporterId: reservation.transporter,
        proposedTransportFee: reservation.proposedTransportFee,
        farmerName: farmer?.name,
      });
    }
  }
};

module.exports = { checkCapacityForConfirm, requestTransport, applyConfirmationEffects };
