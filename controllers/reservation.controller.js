const Reservation = require('../models/Reservation');

exports.createReservation = async (req, res) => {
  // const reservation = await Reservation.create({ ...req.body, user: req.user.id });

  const reservation = await Reservation.create(req.body);

  res.status(201).json(reservation);
};


exports.getReservationByStatus = async (req, res) => {
  const reservations = await Reservation.find({ status: req.params.status }).populate('storage');
  res.json(reservations);
}

// Get all reservations
exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('user', 'name email')
      .populate('storage');
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.updateReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    let reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    if (updates.reservedFrom && updates.reservedTo) {
      const from = new Date(updates.reservedFrom);
      const to = new Date(updates.reservedTo);

      if (from >= to) {
        return res.status(400).json({ message: "reservedFrom must be before reservedTo" });
      }

      if (from < new Date()) {
        return res.status(400).json({ message: "Reservation cannot start in the past" });
      }
    }

    if (updates.reservedFrom || updates.reservedTo) {
      const newFrom = new Date(updates.reservedFrom || reservation.reservedFrom);
      const newTo = new Date(updates.reservedTo || reservation.reservedTo);

      const overlapping = await Reservation.findOne({
        _id: { $ne: reservation._id },
        storage: reservation.storage,
        status: 'CONFIRMÉ',
        reservedFrom: { $lt: newTo },
        reservedTo: { $gt: newFrom }
      });

      if (overlapping) {
        return res.status(400).json({
          message: "Storage already reserved in this period"
        });
      }
    }

  
    reservation = await Reservation.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      message: "Reservation updated successfully",
      reservation
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Get reservation by ID
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('user', 'name email')
      .populate('storage');
    if (!reservation) return res.status(404).json({ error: 'Not found' });
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// // Update reservation
// exports.updateReservation = async (req, res) => {
//   try {
//     const updated = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//     });
//     if (!updated) return res.status(404).json({ error: 'Not found' });
//     res.json(updated);
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// };

// Delete reservation
exports.deleteReservation = async (req, res) => {
  try {
    const deleted = await Reservation.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search reservations by user, storage or status
exports.searchReservations = async (req, res) => {
  try {
    const { user, storage, status } = req.query;
    const query = {};

    if (user) query.user = user;
    if (storage) query.storage = storage;
    if (status) query.status = status;

    const reservations = await Reservation.find(query)
      .populate('user', 'name')
      .populate('storage');

    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// module.exports = { createReservation, getUserReservations, getAllReservations, getReservationById, getReservationByStatus };