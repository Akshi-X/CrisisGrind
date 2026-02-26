const User = require('../models/User');
const Donation = require('../models/Donation');
const Report = require('../models/Report');

const getStats = async (req, res) => {
    try {
        const [userCounts, donationStats, reportCount] = await Promise.all([
            User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
            Donation.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 }, servings: { $sum: '$servings' } } },
            ]),
            Report.countDocuments({ status: 'pending' }),
        ]);
        const usersByRole = userCounts.reduce((a, c) => ({ ...a, [c._id]: c.count }), {});
        const donationsByStatus = donationStats.reduce((a, c) => {
            a[c._id] = { count: c.count, servings: c.servings };
            return a;
        }, {});
        res.json({
            users: usersByRole,
            donations: donationsByStatus,
            pendingReports: reportCount,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const listUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(200);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getStats, listUsers };
