const express = require('express');
const router = express.Router();
const { getStats, listUsers } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/stats', protect, adminOnly, getStats);
router.get('/users', protect, adminOnly, listUsers);

module.exports = router;
