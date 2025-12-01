const Billing = require('../models/Billing');
const Reservation = require('../models/Reservation');
const Storage = require('../models/Storage');

exports.generateBilling = async (reservationId) => {
  const reservation = await Reservation.findById(reservationId)
    .populate('storage')
    .populate('user');

  if (!reservation) throw new Error("Réservation introuvable");
  if (reservation.status !== 'CONFIRMÉ')
    throw new Error("La réservation doit être CONFIRMÉE avant facturation");

  const storage = reservation.storage;

  // Calcul du nombre de jours
  const start = new Date(reservation.reservedFrom);
  const end = new Date(reservation.reservedTo);

  const diffTime = Math.abs(end - start);
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Calcul du total
  const totalAmount = days * storage.costPerKgPerDay;

  // Création de la facture
  const billing = await Billing.create({
    reservation: reservation._id,
    user: reservation.user._id,
    storage: storage._id,
    totalAmount,
    days,
  });

  return billing;
};

exports.updateBillingStatus = async (billingId, status) => {

    if (!["PENDING", "PAID", "CANCELLED"].includes(status)) {
        throw new Error('Statut de facture invalide');
    }
    const billing = await Billing.findById(billingId);
    if (!billing) throw new Error("Facture introuvable");

    billing.status = status;
    await billing.save();

    return billing;
}

exports.getBillingById = async (billingId) => {
    const billing = await Billing.findById(billingId)
        .populate('reservation')
        .populate('user')
        .populate('storage');

    if (!billing) throw new Error("Facture introuvable");

    return billing;
}

exports.getBillingsByStatus = async (status) => {
    const billings = await Billing.find({ status })
        .populate('reservation')
        .populate('user')
        .populate('storage');

    return billings;
}


exports.getBillingsByStorage = async (storageId) => {
    const billings = await Billing.find({ storage: storageId });

    return billings;
}

exports.getAllBillings = async () => {
    const billings = await Billing.find();

    return billings;
}