const express = require('express');
const router = express.Router();
const { createReport, listReports, updateReportStatus } = require('../controllers/reportController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, createReport);
router.get('/', protect, adminOnly, listReports);
router.patch('/:id', protect, adminOnly, updateReportStatus);

module.exports = router;
