const Subscription = require('../model/subscriptionModel');
const Menu = require('../model/menuModel');
const User = require('../model/userModel');
const Branch = require('../model/Branch');
const mongoose = require('mongoose');

// @desc    Create a new subscription
// @route   POST /api/v1/hotel/subscription
// @access  Private
const createSubscription = async (req, res) => {
  try {
    const {
      userId,
      productId,
      branchId,
      subscriptionType,
      quantity,
      deliveryAddress,
      deliveryInstructions,
      paymentMethod,
      deliveryDays,
      deliveryTime,
      autoRenew
    } = req.body;

    // Validate required fields
    if (!userId || !productId || !branchId || !subscriptionType || !quantity || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate subscription type
    if (!['weekly', 'monthly', 'yearly'].includes(subscriptionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription type'
      });
    }

    // Get product details
    const product = await Menu.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Calculate pricing based on subscription type
    let basePrice = product.price * quantity;
    let discount = 0;
    let totalPrice = basePrice;

    switch (subscriptionType) {
      case 'weekly':
        discount = basePrice * 0.05; // 5% discount
        break;
      case 'monthly':
        discount = basePrice * 0.10; // 10% discount
        break;
      case 'yearly':
        discount = basePrice * 0.20; // 20% discount
        break;
    }

    totalPrice = basePrice - discount;

    // Create subscription
    const subscription = new Subscription({
      userId,
      productId,
      branchId,
      subscriptionType,
      quantity,
      price: basePrice,
      discount,
      totalPrice,
      deliveryAddress,
      deliveryInstructions: deliveryInstructions || '',
      paymentMethod: paymentMethod || 'cash',
      deliveryDays: deliveryDays || ['monday', 'wednesday', 'friday'],
      deliveryTime: deliveryTime || '09:00',
      autoRenew: autoRenew !== false,
      subscriptionHistory: [{
        action: 'created',
        notes: 'Subscription created'
      }]
    });

    await subscription.save();

    // Populate the response
    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get all subscriptions for a user
// @route   GET /api/v1/hotel/subscription/user/:userId
// @access  Private
const getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const subscriptions = await Subscription.find(query)
      .populate('productId', 'name price image')
      .populate('branchId', 'name address')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
    });

  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get all subscriptions (Admin)
// @route   GET /api/v1/hotel/subscription
// @access  Private/Admin
const getAllSubscriptions = async (req, res) => {
  try {
    const { status, branchId, subscriptionType, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (branchId) query.branchId = branchId;
    if (subscriptionType) query.subscriptionType = subscriptionType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const subscriptions = await Subscription.find(query)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Subscription.countDocuments(query);

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
      data: subscriptions
    });

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get subscription by ID
// @route   GET /api/v1/hotel/subscription/:id
// @access  Private
const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription ID'
      });
    }

    const subscription = await Subscription.findById(id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.status(200).json({
      success: true,
      data: subscription
    });

  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Pause subscription
// @route   PUT /api/v1/hotel/subscription/:id/pause
// @access  Private
const pauseSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { pauseReason, pauseEndDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription ID'
      });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (subscription.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active subscriptions can be paused'
      });
    }

    const pauseStartDate = new Date();
    const pauseEnd = pauseEndDate ? new Date(pauseEndDate) : new Date(pauseStartDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // Default 30 days

    subscription.status = 'paused';
    subscription.pauseStartDate = pauseStartDate;
    subscription.pauseEndDate = pauseEnd;
    subscription.pauseReason = pauseReason || 'User requested pause';

    // Extend end date by pause duration
    const pauseDuration = pauseEnd.getTime() - pauseStartDate.getTime();
    subscription.endDate = new Date(subscription.endDate.getTime() + pauseDuration);

    subscription.subscriptionHistory.push({
      action: 'paused',
      notes: `Subscription paused: ${pauseReason || 'No reason provided'}`
    });

    await subscription.save();

    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription paused successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error pausing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Resume subscription
// @route   PUT /api/v1/hotel/subscription/:id/resume
// @access  Private
const resumeSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription ID'
      });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (subscription.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Only paused subscriptions can be resumed'
      });
    }

    subscription.status = 'active';
    subscription.pauseStartDate = null;
    subscription.pauseEndDate = null;
    subscription.pauseReason = null;

    subscription.subscriptionHistory.push({
      action: 'resumed',
      notes: 'Subscription resumed'
    });

    await subscription.save();

    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription resumed successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Cancel subscription
// @route   PUT /api/v1/hotel/subscription/:id/cancel
// @access  Private
const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription ID'
      });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (subscription.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is already cancelled'
      });
    }

    subscription.status = 'cancelled';
    subscription.subscriptionHistory.push({
      action: 'cancelled',
      notes: `Subscription cancelled: ${cancellationReason || 'No reason provided'}`
    });

    await subscription.save();

    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Update subscription
// @route   PUT /api/v1/hotel/subscription/:id
// @access  Private
const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription ID'
      });
    }

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['quantity', 'deliveryAddress', 'deliveryInstructions', 'deliveryDays', 'deliveryTime', 'autoRenew'];
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        subscription[field] = updateData[field];
      }
    });

    // Recalculate pricing if quantity changed
    if (updateData.quantity) {
      const product = await Menu.findById(subscription.productId);
      let basePrice = product.price * updateData.quantity;
      let discount = 0;

      switch (subscription.subscriptionType) {
        case 'weekly':
          discount = basePrice * 0.05;
          break;
        case 'monthly':
          discount = basePrice * 0.10;
          break;
        case 'yearly':
          discount = basePrice * 0.20;
          break;
      }

      subscription.price = basePrice;
      subscription.discount = discount;
      subscription.totalPrice = basePrice - discount;
    }

    subscription.subscriptionHistory.push({
      action: 'updated',
      notes: 'Subscription updated'
    });

    await subscription.save();

    const populatedSubscription = await Subscription.findById(subscription._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get subscription statistics
// @route   GET /api/v1/hotel/subscription/stats
// @access  Private/Admin
const getSubscriptionStats = async (req, res) => {
  try {
    const { branchId } = req.query;

    const query = {};
    if (branchId) query.branchId = branchId;

    const totalSubscriptions = await Subscription.countDocuments(query);
    const activeSubscriptions = await Subscription.countDocuments({ ...query, status: 'active' });
    const pausedSubscriptions = await Subscription.countDocuments({ ...query, status: 'paused' });
    const cancelledSubscriptions = await Subscription.countDocuments({ ...query, status: 'cancelled' });

    const subscriptionTypeStats = await Subscription.aggregate([
      { $match: query },
      { $group: { _id: '$subscriptionType', count: { $sum: 1 } } }
    ]);

    const monthlyRevenue = await Subscription.aggregate([
      { $match: { ...query, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSubscriptions,
        activeSubscriptions,
        pausedSubscriptions,
        cancelledSubscriptions,
        subscriptionTypeStats,
        monthlyRevenue: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0
      }
    });

  } catch (error) {
    console.error('Error fetching subscription stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createSubscription,
  getUserSubscriptions,
  getAllSubscriptions,
  getSubscriptionById,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  updateSubscription,
  getSubscriptionStats
};







