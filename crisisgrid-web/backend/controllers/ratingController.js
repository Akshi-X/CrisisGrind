const Rating = require('../models/Rating');
const Donation = require('../models/Donation');

const submitRating = async (req, res) => {
    try {
        const { donationId, toUserId, role, score, comment } = req.body;
        if (!donationId || !toUserId || !role || score == null) {
            return res.status(400).json({ message: 'donationId, toUserId, role, and score are required' });
        }
        const s = Math.min(5, Math.max(1, parseInt(score)));
        const donation = await Donation.findById(donationId);
        if (!donation) return res.status(404).json({ message: 'Donation not found' });
        const existing = await Rating.findOne({ donationId, fromUserId: req.user._id });
        if (existing) {
            existing.score = s;
            existing.comment = comment || '';
            await existing.save();
            return res.json(existing);
        }
        const rating = await Rating.create({
            fromUserId: req.user._id,
            toUserId,
            donationId,
            role,
            score: s,
            comment: comment || '',
        });
        res.status(201).json(rating);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getRatingsForUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const ratings = await Rating.find({ toUserId: userId })
            .populate('fromUserId', 'name role')
            .sort({ createdAt: -1 })
            .limit(50);
        const avg = ratings.length ? (ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(1) : null;
        res.json({ ratings, average: avg ? parseFloat(avg) : null, count: ratings.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { submitRating, getRatingsForUser };
