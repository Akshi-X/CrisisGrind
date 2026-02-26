const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, trim: true, default: 'My search' },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        foodType: { type: String, enum: ['veg', 'non-veg', ''], default: '' },
        minServings: { type: Number, default: null },
        maxDistance: { type: Number, default: 50000 },
    },
    { timestamps: true }
);

savedSearchSchema.index({ userId: 1 });

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
