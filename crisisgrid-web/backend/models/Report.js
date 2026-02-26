const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
    {
        reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reportedDonationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null },
        reason: { type: String, required: true, trim: true },
        status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
