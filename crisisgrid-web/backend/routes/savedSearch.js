const express = require('express');
const router = express.Router();
const { createSavedSearch, getMySavedSearches, deleteSavedSearch } = require('../controllers/savedSearchController');
const { protect, ngoOnly } = require('../middleware/auth');

router.post('/', protect, ngoOnly, createSavedSearch);
router.get('/', protect, ngoOnly, getMySavedSearches);
router.delete('/:id', protect, ngoOnly, deleteSavedSearch);

module.exports = router;
