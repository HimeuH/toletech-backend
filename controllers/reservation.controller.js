const Reservation = require('../models/Reservation');

exports.createReservation = async (req, res) => {
  // const reservation = await Reservation.create({ ...req.body, user: req.user.id });
  const reservation = await Reservation.create({
    ...req.body,
    user: req.user.id
  });

  res.status(201).json(reservation);
};


exports.getReservationByStatus = async (req, res) => {
  const reservations = await Reservation.find({ status: req.params.status });
  res.json(reservations);
}

// Get all reservations
exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find();
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get reservations for current user
exports.getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ user: req.user.id });
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
    if (req.user.role !== 'ADMIN' && reservation.user?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (req.user.role !== 'ADMIN') {
      if (reservation.status !== 'EN_ATTENTE') {
        return res.status(403).json({ message: "Only pending reservations can be updated" });
      }

      if (updates.status && updates.status !== 'ANNULÉ') {
        return res.status(403).json({ message: "Only admin can confirm reservations" });
      }
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
      .populate({ path: 'storage', populate: { path: 'owner', select: 'name email' } });
    if (!reservation) return res.status(404).json({ error: 'Not found' });

    const isOwner = reservation.user?.toString() === req.user.id;
    const isStorageOwner = reservation.storage?.owner?.toString() === req.user.id;

    if (req.user.role !== 'ADMIN' && !isOwner && !isStorageOwner) {
      return res.status(403).json({ message: "Forbidden" });
    }

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
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'ADMIN' && reservation.user?.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

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

    if (status) query.status = status;

    if (req.user.role === 'AGRICULTEUR') {
      query.user = req.user.id;
      if (storage) query.storage = storage;
    } else if (req.user.role === 'PROPRIETAIRE' || req.user.role === 'TRANSFORMATEUR') {
      const ownedStorages = await Storage.find({ owner: req.user.id }).select('_id');
      query.storage = { $in: ownedStorages.map((s) => s._id) };
    } else if (req.user.role === 'AGENT' || req.user.role === 'ADMIN') {
      if (user) query.user = user;
      if (storage) query.storage = storage;
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const reservations = await Reservation.find(query);

    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// module.exports = { createReservation, getUserReservations, getAllReservations, getReservationById, getReservationByStatus };
