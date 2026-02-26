const Report = require('../models/Report');
const User = require('../models/User');
const Donation = require('../models/Donation');

const createReport = async (req, res) => {
    try {
        const { reportedUserId, reportedDonationId, reason } = req.body;
        if (!reason || (!reportedUserId && !reportedDonationId)) {
            return res.status(400).json({ message: 'Provide reason and either reportedUserId or reportedDonationId' });
        }
        const report = await Report.create({
            reporterId: req.user._id,
            reportedUserId: reportedUserId || null,
            reportedDonationId: reportedDonationId || null,
            reason: reason.trim(),
        });
        res.status(201).json(report);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const listReports = async (req, res) => {
    try {
        const reports = await Report.find()
            .populate('reporterId', 'name email role')
            .populate('reportedUserId', 'name email role')
            .populate('reportedDonationId', 'foodName status')
            .sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateReportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['pending', 'reviewed', 'resolved'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        const report = await Report.findByIdAndUpdate(id, { status }, { new: true });
        if (!report) return res.status(404).json({ message: 'Report not found' });
        res.json(report);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createReport, listReports, updateReportStatus };
