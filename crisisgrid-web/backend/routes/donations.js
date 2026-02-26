const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
const { protect, donorOnly, ngoOnly, deliveryOnly } = require('../middleware/auth');

const {
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
    getMapData,
    getAvailableMissions,
    acceptMission,
    updateMissionStatus,
    updateMissionLocation,
    getDeliveryHistory,
    getActiveMission,
} = donationController;

router.get('/stats', getStats);                       // Public — for landing page
router.get('/map-data', getMapData);                  // Public — heat map data
router.get('/analytics/me', protect, getMyAnalytics);  // My impact (donor/ngo/delivery)
router.post('/', protect, donorOnly, createDonation); // Donors add donations
router.get('/search', protect, searchDonations);      // NGOs search
router.get('/my', protect, donorOnly, getMyDonations);// Donor's own donations
router.get('/claims', protect, ngoOnly, getMyClaims); // NGO's claimed donations
router.patch('/:id', protect, donorOnly, updateDonation); // Donor edit (available only)
router.delete('/:id', protect, donorOnly, deleteDonation); // Donor remove (available only)
router.patch('/:id/claim', protect, ngoOnly, claimDonation); // Atomic claim
router.patch('/:id/release', protect, ngoOnly, releaseClaim); // NGO release claim
router.patch('/:id/extend', protect, donorOnly, extendExpiry); // Donor extend expiry

router.get('/missions/available', protect, deliveryOnly, getAvailableMissions);
router.get('/missions/active', protect, deliveryOnly, getActiveMission);
router.patch('/missions/:id/accept', protect, deliveryOnly, acceptMission);
router.patch('/missions/:id/status', protect, deliveryOnly, updateMissionStatus);
router.patch('/missions/:id/location', protect, deliveryOnly, updateMissionLocation);
router.get('/missions/history', protect, deliveryOnly, getDeliveryHistory);

module.exports = router;
