const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
    {
        fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
        role: { type: String, enum: ['donor', 'ngo', 'delivery'], required: true }, // role of toUser in this context
        score: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, trim: true, default: '' },
    },
    { timestamps: true }
);

ratingSchema.index({ donationId: 1, fromUserId: 1 }, { unique: true });
ratingSchema.index({ toUserId: 1 });

module.exports = mongoose.model('Rating', ratingSchema);
