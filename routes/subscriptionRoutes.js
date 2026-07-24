const express = require('express');
const router = express.Router();
const subscriptionController = require('../controller/subscriptionController');

// @route   POST /api/v1/hotel/subscription
// @desc    Create a new subscription
// @access  Private
router.post('/', subscriptionController.createSubscription);

// @route   GET /api/v1/hotel/subscription/stats
// @desc    Get subscription statistics
// @access  Private/Admin
router.get('/stats', subscriptionController.getSubscriptionStats);

// @route   GET /api/v1/hotel/subscription/user/:userId
// @desc    Get all subscriptions for a user
// @access  Private
router.get('/user/:userId', subscriptionController.getUserSubscriptions);

// @route   GET /api/v1/hotel/subscription
// @desc    Get all subscriptions (Admin)
// @access  Private/Admin
router.get('/', subscriptionController.getAllSubscriptions);

// @route   GET /api/v1/hotel/subscription/:id
// @desc    Get subscription by ID
// @access  Private
router.get('/:id', subscriptionController.getSubscriptionById);

// @route   PUT /api/v1/hotel/subscription/:id/pause
// @desc    Pause subscription
// @access  Private
router.put('/:id/pause', subscriptionController.pauseSubscription);

// @route   PUT /api/v1/hotel/subscription/:id/resume
// @desc    Resume subscription
// @access  Private
router.put('/:id/resume', subscriptionController.resumeSubscription);

// @route   PUT /api/v1/hotel/subscription/:id/cancel
// @desc    Cancel subscription
// @access  Private
router.put('/:id/cancel', subscriptionController.cancelSubscription);

// @route   PUT /api/v1/hotel/subscription/:id
// @desc    Update subscription
// @access  Private
router.put('/:id', subscriptionController.updateSubscription);

module.exports = router;