const express = require('express');
const router = express.Router();
const { submitRating, getRatingsForUser } = require('../controllers/ratingController');
const { protect } = require('../middleware/auth');

router.post('/', protect, submitRating);
router.get('/user/:userId', protect, getRatingsForUser);

module.exports = router;
