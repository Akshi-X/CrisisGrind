const SavedSearch = require('../models/SavedSearch');

const createSavedSearch = async (req, res) => {
    try {
        const { name, lat, lng, foodType, minServings, maxDistance } = req.body;
        if (lat == null || lng == null) return res.status(400).json({ message: 'lat and lng required' });
        const search = await SavedSearch.create({
            userId: req.user._id,
            name: name || 'My search',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            foodType: foodType || '',
            minServings: minServings ? parseInt(minServings) : null,
            maxDistance: maxDistance ? parseInt(maxDistance) : 50000,
        });
        res.status(201).json(search);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getMySavedSearches = async (req, res) => {
    try {
        const list = await SavedSearch.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteSavedSearch = async (req, res) => {
    try {
        const { id } = req.params;
        const search = await SavedSearch.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!search) return res.status(404).json({ message: 'Saved search not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createSavedSearch, getMySavedSearches, deleteSavedSearch };
