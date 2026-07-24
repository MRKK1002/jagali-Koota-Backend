const express = require('express');
const router = express.Router();
const subscriptionOrderController = require('../controller/subscriptionOrderController');

// @route   POST /api/v1/hotel/subscription-order
// @desc    Create a new subscription order
// @access  Private
router.post('/', subscriptionOrderController.createSubscriptionOrder);

// @route   GET /api/v1/hotel/subscription-order/stats
// @desc    Get subscription order statistics
// @access  Private/Admin
router.get('/stats', subscriptionOrderController.getSubscriptionOrderStats);

// @route   POST /api/v1/hotel/subscription-order/process-recurring
// @desc    Process recurring orders (CRON job)
// @access  Private/Admin
router.post('/process-recurring', subscriptionOrderController.processRecurringOrders);

// @route   GET /api/v1/hotel/subscription-order/user/:userId
// @desc    Get all subscription orders for a user
// @access  Private
router.get('/user/:userId', subscriptionOrderController.getUserSubscriptionOrders);

// @route   GET /api/v1/hotel/subscription-order
// @desc    Get all subscription orders (Admin)
// @access  Private/Admin
router.get('/', subscriptionOrderController.getAllSubscriptionOrders);

// @route   GET /api/v1/hotel/subscription-order/:id
// @desc    Get subscription order by ID
// @access  Private
router.get('/:id', subscriptionOrderController.getSubscriptionOrderById);

// @route   PUT /api/v1/hotel/subscription-order/:id/pause
// @desc    Pause subscription order
// @access  Private
router.put('/:id/pause', subscriptionOrderController.pauseSubscriptionOrder);

// @route   PUT /api/v1/hotel/subscription-order/:id/resume
// @desc    Resume subscription order
// @access  Private
router.put('/:id/resume', subscriptionOrderController.resumeSubscriptionOrder);

// @route   PUT /api/v1/hotel/subscription-order/:id/cancel
// @desc    Cancel subscription order
// @access  Private
router.put('/:id/cancel', subscriptionOrderController.cancelSubscriptionOrder);

// @route   PUT /api/v1/hotel/subscription-order/:id
// @desc    Update subscription order
// @access  Private
router.put('/:id', subscriptionOrderController.updateSubscriptionOrder);

// @route   PUT /api/v1/hotel/subscription-order/:id/delivery
// @desc    Update delivery status
// @access  Private
router.put('/:id/delivery', subscriptionOrderController.updateDeliveryStatus);

// @route   GET /api/v1/hotel/subscription-order/:id/delivery-tracking
// @desc    Get delivery tracking for a subscription
// @access  Private
router.get('/:id/delivery-tracking', subscriptionOrderController.getDeliveryTracking);

module.exports = router;