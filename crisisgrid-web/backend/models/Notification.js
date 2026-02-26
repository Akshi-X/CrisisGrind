const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, required: true }, // 'donation_claimed', 'mission_accepted', 'delivered', 'claim_released', etc.
        title: { type: String, required: true },
        message: { type: String, default: '' },
        donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
