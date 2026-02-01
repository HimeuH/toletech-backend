const Storage = require('../models/Storage');

// Create new storage
exports.createStorage = async (req, res) => {
  try {
    const storage = new Storage(req.body);
    const saved = await storage.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all storages
exports.getAllStorages = async (req, res) => {
  try {
    const storages = await Storage.find();
    res.status(200).json(storages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get storages for current user (owner)
exports.getMyStorages = async (req, res) => {
  try {
    const storages = await Storage.find({ owner: req.user.id });
    res.status(200).json(storages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get storage by ID
exports.getStorageById = async (req, res) => {
  try {
    const storage = await Storage.findById(req.params.id).populate('owner');
    if (!storage) return res.status(404).json({ message: 'Storage not found' });
    res.status(200).json(storage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update storage
exports.updateStorage = async (req, res) => {
  try {
    const storage = await Storage.findById(req.params.id);
    if (!storage) return res.status(404).json({ message: 'Storage not found' });

    if (req.user.role !== 'ADMIN' && storage.owner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updated = await Storage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Storage not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getStorageByOwner = async (req, res) => {
  try {
    const storages = await Storage.find({ owner: req.params.id });
    res.status(200).json(storages);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }

}

exports.getStorageByStatus = async (req, res) => {
  try {
    const storages = await Storage.find({ isAvailable: req.params.status });
    res.status(200).json(storages);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
}

// Delete storage
exports.deleteStorage = async (req, res) => {
  try {
    const storage = await Storage.findById(req.params.id);
    if (!storage) return res.status(404).json({ message: 'Storage not found' });

    if (req.user.role !== 'ADMIN' && storage.owner?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const deleted = await Storage.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Storage not found' });
    res.status(200).json({ message: 'Storage deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search storages by criteria
exports.searchStorages = async (req, res) => {
  try {
    const { location, productType, from, to } = req.query;

    const query = {
      ...(location && { location: { $regex: location, $options: 'i' } }),
      ...(productType && { productType }),
      ...(from && to && {
        availableFrom: { $lte: new Date(from) },
        availableTo: { $gte: new Date(to) },
        isAvailable: true
      }),
    };

    const results = await Storage.find(query);
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
