const Notification = require('../models/Notification');

const createNotification = async (userId, type, title, message, donationId = null) => {
    try {
        await Notification.create({ userId, type, title, message, donationId });
    } catch (err) {
        console.error('Create notification error:', err);
    }
};

const getMyNotifications = async (req, res) => {
    try {
        const list = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
        res.json({ notifications: list, unreadCount });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const markRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findOneAndUpdate({ _id: id, userId: req.user._id }, { read: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user._id }, { read: true });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createNotification, getMyNotifications, markRead, markAllRead };
