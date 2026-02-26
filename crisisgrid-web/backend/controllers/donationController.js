const axios = require('axios');
const Donation = require('../models/Donation');
const { createNotification } = require('./notificationController');
const multer = require('multer');
const path = require('path');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetypes = /image\/jpeg|image\/jpg|image\/png|image\/webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = mimetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed'));
    },
}).single('image');

// Geocode address using OpenStreetMap Nominatim (free, no key needed)
const geocodeAddress = async (address) => {
    try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1 },
            headers: { 'User-Agent': 'CrisisGrid-App/1.0' },
            timeout: 8000,
        });
        if (response.data && response.data.length > 0) {
            const { lat, lon } = response.data[0];
            return { lat: parseFloat(lat), lng: parseFloat(lon) };
        }
        return null;
    } catch (err) {
        console.error('Geocoding failed:', err.message);
        return null;
    }
};

// @POST /api/donations — donor adds a new donation
const createDonation = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        try {
            const { foodName, description, foodType, servings, address, pickupTimeWindow, expiryHours } = req.body;

            if (!foodName || !description || !foodType || !servings || !address) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            const coords = await geocodeAddress(address);
            if (!coords) {
                return res.status(400).json({
                    message: 'Could not find coordinates for the provided address. Please be more specific.',
                });
            }

            const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
            const hours = [1, 3, 6, 12, 24, 48].includes(parseInt(expiryHours)) ? parseInt(expiryHours) : 24;
            const expiryTime = new Date(Date.now() + hours * 60 * 60 * 1000);

            const donation = await Donation.create({
                donorId: req.user._id,
                foodName,
                description,
                foodType,
                servings: parseInt(servings),
                address,
                pickupLocation: {
                    type: 'Point',
                    coordinates: [coords.lng, coords.lat],
                },
                imageUrl,
                pickupTimeWindow: pickupTimeWindow || null,
                expiryTime,
            });

            res.status(201).json(donation);
        } catch (err) {
            console.error('Create donation error:', err);
            res.status(500).json({ message: err.message });
        }
    });
};

// @GET /api/donations/search — NGO searches with geo + filters
const searchDonations = async (req, res) => {
    try {
        const { lat, lng, foodType, minServings, maxDistance = 50000 } = req.query;

        console.log(`🔍 NGO Search searching near [${lat}, ${lng}] with filters:`, { foodType, minServings });

        const matchStage = { status: 'available', expiryTime: { $gt: new Date() } };
        if (foodType && (foodType === 'veg' || foodType === 'non-veg')) {
            matchStage.foodType = foodType;
        }
        if (minServings) {
            matchStage.servings = { $gte: parseInt(minServings) };
        }

        console.log('Match Stage:', matchStage);

        // $geoNear MUST be the first stage in an aggregation pipeline
        const pipeline = [
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    distanceField: 'distance', // in meters
                    maxDistance: parseInt(maxDistance), // default 50km
                    spherical: true,
                },
            },
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'donorId',
                    foreignField: '_id',
                    as: 'donor',
                },
            },
            { $unwind: { path: '$donor', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    foodName: 1,
                    description: 1,
                    foodType: 1,
                    servings: 1,
                    address: 1,
                    status: 1,
                    distance: 1,
                    createdAt: 1,
                    expiryTime: 1,
                    pickupTimeWindow: 1,
                    pickupLocation: 1,
                    'donor.name': 1,
                    'donor.phone': 1,
                    imageUrl: 1,
                },
            },
            { $sort: { distance: 1 } },
            { $limit: 50 },
        ];

        const donations = await Donation.aggregate(pipeline);

        // Convert distance from meters to km
        const enriched = donations.map((d) => ({
            ...d,
            distanceKm: (d.distance / 1000).toFixed(2),
            etaMinutes: Math.max(1, Math.round((d.distance / 1000 / 30) * 60)), // avg 30 km/h
        }));

        res.json(enriched);
    } catch (err) {
        console.error('Search donations error:', err);
        res.status(500).json({ message: err.message });
    }
};

// @PATCH /api/donations/:id — donor updates own donation (only when available)
const updateDonation = (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err.message });
        try {
            const { id } = req.params;
            const { foodName, description, foodType, servings, address, pickupTimeWindow } = req.body;
            const donation = await Donation.findOne({ _id: id, donorId: req.user._id, status: 'available' });
            if (!donation) return res.status(404).json({ message: 'Donation not found or not editable' });

            const updates = {};
            if (foodName !== undefined) updates.foodName = foodName;
            if (description !== undefined) updates.description = description;
            if (foodType !== undefined) updates.foodType = foodType;
            if (servings !== undefined) updates.servings = parseInt(servings);
            if (pickupTimeWindow !== undefined) updates.pickupTimeWindow = pickupTimeWindow || null;
            if (req.file) updates.imageUrl = `/uploads/${req.file.filename}`;
            if (req.body.expiryHours !== undefined) {
                const h = [1, 3, 6, 12, 24, 48].includes(parseInt(req.body.expiryHours)) ? parseInt(req.body.expiryHours) : 24;
                updates.expiryTime = new Date(Date.now() + h * 60 * 60 * 1000);
            }

            if (address !== undefined && address !== donation.address) {
                const coords = await geocodeAddress(address);
                if (!coords) return res.status(400).json({ message: 'Could not geocode address' });
                updates.address = address;
                updates.pickupLocation = { type: 'Point', coordinates: [coords.lng, coords.lat] };
            }

            const updated = await Donation.findByIdAndUpdate(id, updates, { new: true });
            res.json(updated);
        } catch (err) {
            console.error('Update donation error:', err);
            res.status(500).json({ message: err.message });
        }
    });
};

// @DELETE /api/donations/:id — donor removes own donation (only when available)
const deleteDonation = async (req, res) => {
    try {
        const { id } = req.params;
        const donation = await Donation.findOneAndDelete({ _id: id, donorId: req.user._id, status: 'available' });
        if (!donation) return res.status(404).json({ message: 'Donation not found or cannot be removed' });
        res.json({ message: 'Donation removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @PATCH /api/donations/:id/release — NGO releases claim (only before delivery picks up)
const releaseClaim = async (req, res) => {
    try {
        const { id } = req.params;
        const donation = await Donation.findOneAndUpdate(
            { _id: id, claimedBy: req.user._id, deliveryStatus: 'waiting_for_delivery' },
            { status: 'available', claimedBy: null, claimedAt: null, deliveryStatus: null },
            { new: true }
        );
        if (!donation) return res.status(404).json({ message: 'Cannot release: not your claim or delivery already accepted' });
        await createNotification(
            donation.donorId,
            'claim_released',
            'Claim released',
            `The claim on "${donation.foodName}" was released. It is available again.`,
            donation._id
        );
        res.json({ message: 'Claim released', donation });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @PATCH /api/donations/:id/extend — donor extends expiry by 24h
const extendExpiry = async (req, res) => {
    try {
        const { id } = req.params;
        const donation = await Donation.findOne({ _id: id, donorId: req.user._id });
        if (!donation) return res.status(404).json({ message: 'Donation not found' });
        const newExpiry = new Date(Math.max(Date.now(), new Date(donation.expiryTime).getTime()) + 1 * 60 * 60 * 1000); // extend by 1 hour
        const updated = await Donation.findByIdAndUpdate(id, { expiryTime: newExpiry }, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/my — donor's own donations
const getMyDonations = async (req, res) => {
    try {
        const donations = await Donation.find({ donorId: req.user._id }).sort({ createdAt: -1 });
        res.json(donations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/claims — NGO's claimed donations
const getMyClaims = async (req, res) => {
    try {
        const claims = await Donation.find({ claimedBy: req.user._id })
            .populate('donorId', 'name phone address')
            .sort({ claimedAt: -1 });
        res.json(claims);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @PATCH /api/donations/:id/claim — atomic claim (prevents double-claiming)
const claimDonation = async (req, res) => {
    try {
        const { id } = req.params;

        // Atomic update: only succeeds if status is still "available"
        const donation = await Donation.findOneAndUpdate(
            { _id: id, status: 'available' },
            {
                status: 'claimed',
                claimedBy: req.user._id,
                claimedAt: new Date(),
                deliveryStatus: 'waiting_for_delivery'
            },
            { new: true }
        );

        if (!donation) {
            return res.status(409).json({
                message: 'This donation has already been claimed by another NGO.',
            });
        }
        await createNotification(
            donation.donorId,
            'donation_claimed',
            'Donation claimed',
            `Your donation "${donation.foodName}" was claimed by an NGO.`,
            donation._id
        );
        res.json({ message: 'Donation claimed successfully', donation });
    } catch (err) {
        console.error('Claim donation error:', err);
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/analytics/me — impact for current user (donor/ngo/delivery)
const getMyAnalytics = async (req, res) => {
    try {
        const role = req.user.role;
        if (role === 'donor') {
            const [listed, claimed, servings] = await Promise.all([
                Donation.countDocuments({ donorId: req.user._id }),
                Donation.countDocuments({ donorId: req.user._id, status: 'claimed' }),
                Donation.aggregate([{ $match: { donorId: req.user._id, status: 'claimed' } }, { $group: { _id: null, total: { $sum: '$servings' } } }]),
            ]);
            return res.json({ listed, claimed, mealsRescued: servings[0]?.total || 0 });
        }
        if (role === 'ngo') {
            const [claimed, servings] = await Promise.all([
                Donation.countDocuments({ claimedBy: req.user._id }),
                Donation.aggregate([{ $match: { claimedBy: req.user._id } }, { $group: { _id: null, total: { $sum: '$servings' } } }]),
            ]);
            return res.json({ claimed, mealsRescued: servings[0]?.total || 0 });
        }
        if (role === 'delivery') {
            const delivered = await Donation.countDocuments({ deliveryPartnerId: req.user._id, deliveryStatus: 'delivered' });
            const servings = await Donation.aggregate([
                { $match: { deliveryPartnerId: req.user._id, deliveryStatus: 'delivered' } },
                { $group: { _id: null, total: { $sum: '$servings' } } },
            ]);
            return res.json({ delivered, mealsDelivered: servings[0]?.total || 0 });
        }
        res.json({});
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/map-data — heat map: donor locations (available) + request/claim locations
const getMapData = async (req, res) => {
    try {
        const donations = await Donation.find({
            pickupLocation: { $exists: true },
            'pickupLocation.coordinates.0': { $exists: true },
        }).select('pickupLocation status');
        const donors = []; // available donation pickups [lat, lng, intensity]
        const requests = []; // claimed donation pickups (demand) [lat, lng, intensity]
        donations.forEach((d) => {
            const coords = d.pickupLocation?.coordinates;
            if (!coords || coords.length < 2) return;
            const lat = coords[1];
            const lng = coords[0];
            if (d.status === 'available') donors.push([lat, lng, 0.8]);
            else requests.push([lat, lng, 0.8]);
        });
        res.json({ donors, requests });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @PATCH /api/donations/missions/:id/location — delivery partner updates real-time location
const updateMissionLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;
        if (lat == null || lng == null) return res.status(400).json({ message: 'lat and lng required' });
        const mission = await Donation.findOneAndUpdate(
            { _id: id, deliveryPartnerId: req.user._id, deliveryStatus: { $in: ['accepted_by_delivery', 'picked_up'] } },
            {
                deliveryPartnerLocation: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                deliveryPartnerLocationAt: new Date(),
            },
            { new: true }
        );
        if (!mission) return res.status(404).json({ message: 'Mission not found' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/stats — impact counters for landing page
const getStats = async (req, res) => {
    try {
        const totalDonations = await Donation.countDocuments();
        const claimedDonations = await Donation.countDocuments({ status: 'claimed' });
        const totalServings = await Donation.aggregate([
            { $match: { status: 'claimed' } },
            { $group: { _id: null, total: { $sum: '$servings' } } },
        ]);

        res.json({
            totalDonations,
            claimedDonations,
            mealsRescued: totalServings[0]?.total || 0,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/missions/available — Delivery Partner searches for available missions
const getAvailableMissions = async (req, res) => {
    try {
        const missions = await Donation.find({
            status: 'claimed',
            deliveryStatus: 'waiting_for_delivery',
        })
            .populate('donorId', 'name phone location address')
            .populate('claimedBy', 'organizationName name phone location address')
            .sort({ claimedAt: -1 });

        res.json(missions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @PATCH /api/donations/missions/:id/accept — Atomic accept mission
const acceptMission = async (req, res) => {
    try {
        const { id } = req.params;
        const mission = await Donation.findOneAndUpdate(
            { _id: id, deliveryStatus: 'waiting_for_delivery' },
            {
                deliveryStatus: 'accepted_by_delivery',
                deliveryPartnerId: req.user._id,
            },
            { new: true }
        )
            .populate('donorId', 'name phone address')
            .populate('claimedBy', 'organizationName phone address');

        if (!mission) {
            return res.status(409).json({ message: 'Mission already accepted by another partner' });
        }
        await createNotification(mission.donorId._id || mission.donorId, 'mission_accepted', 'Delivery accepted', `A delivery partner accepted pickup for "${mission.foodName}".`, mission._id);
        await createNotification(mission.claimedBy._id || mission.claimedBy, 'mission_accepted', 'Delivery accepted', `A delivery partner is on the way for "${mission.foodName}".`, mission._id);
        res.json(mission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @PATCH /api/donations/missions/:id/status — Mark picked up or delivered
const updateMissionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'picked_up' | 'delivered'

        const mission = await Donation.findOneAndUpdate(
            { _id: id, deliveryPartnerId: req.user._id },
            { deliveryStatus: status },
            { new: true }
        );

        if (!mission) {
            return res.status(404).json({ message: 'Active mission not found' });
        }
        if (status === 'delivered') {
            const donorId = mission.donorId && mission.donorId._id ? mission.donorId._id : mission.donorId;
            const ngoId = mission.claimedBy && mission.claimedBy._id ? mission.claimedBy._id : mission.claimedBy;
            if (donorId) await createNotification(donorId, 'delivered', 'Delivery completed', `"${mission.foodName}" was delivered to the NGO.`, mission._id);
            if (ngoId) await createNotification(ngoId, 'delivered', 'Delivery completed', `"${mission.foodName}" has been delivered to you.`, mission._id);
        }
        res.json(mission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/missions/history — Delivery history for partner
const getDeliveryHistory = async (req, res) => {
    try {
        const history = await Donation.find({
            deliveryPartnerId: req.user._id,
            deliveryStatus: 'delivered',
        }).sort({ updatedAt: -1 });

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @GET /api/donations/missions/active — Fetch current active mission for partner
const getActiveMission = async (req, res) => {
    try {
        const mission = await Donation.findOne({
            deliveryPartnerId: req.user._id,
            deliveryStatus: { $in: ['accepted_by_delivery', 'picked_up'] }
        })
            .populate('donorId', 'name phone location address')
            .populate('claimedBy', 'organizationName name phone location address');

        res.json(mission || null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createDonation,
    updateDonation,
    deleteDonation,
    releaseClaim,
    extendExpiry,
    searchDonations,
    getMyDonations,
    getMyClaims,
    claimDonation,
    getMyAnalytics,
    getStats,
    getAvailableMissions,
    acceptMission,
    updateMissionStatus,
    getDeliveryHistory,
    getActiveMission,
    getMapData,
    updateMissionLocation,
    geocodeAddress,
};
