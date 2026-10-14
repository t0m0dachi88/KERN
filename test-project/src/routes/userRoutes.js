const express = require('express');
const { getProfile, updateProfile } = require('../controllers/userController');
const protect = require('../middlewares/authMiddleware');

const router = express.Router();

// @route   GET /api/user/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', protect, getProfile);

// @route   PUT /api/user/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', protect, updateProfile);

module.exports = router;
