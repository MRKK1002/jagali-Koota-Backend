const SubscriptionOrder = require('../model/subscriptionOrderModel');
const Menu = require('../model/menuModel');
const Order = require('../model/orderModel');
const User = require('../model/userModel');
const Branch = require('../model/Branch');
const mongoose = require('mongoose');

// @desc    Create a new subscription order
// @route   POST /api/v1/hotel/subscription-order
// @access  Private
const createSubscriptionOrder = async (req, res) => {
  try {
    const {
      userId,
      productId,
      branchId,
      planType,
      deliveryAddress,
      deliveryInstructions,
      deliveryDays,
      deliveryTime,
      paymentMethod,
      totalCycles
    } = req.body;

    // Validate required fields with specific messages
    const missingFields = [];
    if (!userId) missingFields.push('userId');
    if (!productId) missingFields.push('productId');
    if (!branchId) missingFields.push('branchId');
    if (!planType) missingFields.push('planType');
    if (!deliveryAddress) missingFields.push('deliveryAddress');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Get product details and validate subscription plans
    const product = await Menu.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (!product.subscriptionEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not enabled for this product'
      });
    }

    // Find the subscription plan - support both old and new structure
    let subscriptionPlan = null;
    
    // For new tiered pricing, create a temporary plan object
    if (planType === 'daily' && product.subscription3Days > 0) {
      subscriptionPlan = { type: 'daily', price: product.subscription3Days, isActive: true };
    } else if (planType === 'weekly' && product.subscription1Week > 0) {
      subscriptionPlan = { type: 'weekly', price: product.subscription1Week, isActive: true };
    } else if (planType === 'monthly' && product.subscription1Month > 0) {
      subscriptionPlan = { type: 'monthly', price: product.subscription1Month, isActive: true };
    } else {
      // Fallback to old subscriptionPlans structure
      subscriptionPlan = product.subscriptionPlans.find(plan => 
        plan.type === planType && plan.isActive
      );
    }

    if (!subscriptionPlan) {
      return res.status(400).json({
        success: false,
        message: 'Subscription plan not found or inactive'
      });
    }

    // Check if user already has an active subscription for this product
    const existingSubscription = await SubscriptionOrder.findOne({
      userId,
      productId,
      branchId,
      status: { $in: ['active', 'paused'] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active subscription for this product'
      });
    }

    // Calculate next delivery date
    const startDate = new Date();
    let nextDeliveryDate = new Date(startDate);
    
    switch (planType) {
      case 'daily':
        nextDeliveryDate.setDate(startDate.getDate() + 1);
        break;
      case 'weekly':
        nextDeliveryDate.setDate(startDate.getDate() + 7);
        break;
      case 'monthly':
        nextDeliveryDate.setMonth(startDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDeliveryDate.setFullYear(startDate.getFullYear() + 1);
        break;
    }

    // Create subscription order
    const subscriptionOrder = new SubscriptionOrder({
      userId,
      productId,
      branchId,
      planType,
      price: subscriptionPlan.price,
      startDate: startDate,
      nextDeliveryDate: nextDeliveryDate,
      deliveryAddress,
      deliveryInstructions: deliveryInstructions || '',
      deliveryDays: deliveryDays || ['monday', 'wednesday', 'friday'],
      deliveryTime: deliveryTime || '09:00',
      paymentMethod: paymentMethod || 'cash',
      totalCycles,
      subscriptionHistory: [{
        action: 'created',
        notes: 'Subscription order created'
      }]
    });

    await subscriptionOrder.save();

    // Populate the response
    const populatedSubscription = await SubscriptionOrder.findById(subscriptionOrder._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(201).json({
      success: true,
      message: 'Subscription order created successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error creating subscription order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get all subscription orders for a user
// @route   GET /api/v1/hotel/subscription-order/user/:userId
// @access  Private
const getUserSubscriptionOrders = async (req, res) => {
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

    const subscriptionOrders = await SubscriptionOrder.find(query)
      .populate('productId', 'name price image subscriptionPlans')
      .populate('branchId', 'name address')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptionOrders.length,
      data: subscriptionOrders
    });

  } catch (error) {
    console.error('Error fetching user subscription orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get all subscription orders (Admin)
// @route   GET /api/v1/hotel/subscription-order
// @access  Private/Admin
const getAllSubscriptionOrders = async (req, res) => {
  try {
    const { status, branchId, planType, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (branchId) query.branchId = branchId;
    if (planType) query.planType = planType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const subscriptionOrders = await SubscriptionOrder.find(query)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SubscriptionOrder.countDocuments(query);

    res.status(200).json({
      success: true,
      count: subscriptionOrders.length,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
      data: subscriptionOrders
    });

  } catch (error) {
    console.error('Error fetching subscription orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get subscription order by ID
// @route   GET /api/v1/hotel/subscription-order/:id
// @access  Private
const getSubscriptionOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription order ID'
      });
    }

    const subscriptionOrder = await SubscriptionOrder.findById(id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    if (!subscriptionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: subscriptionOrder
    });

  } catch (error) {
    console.error('Error fetching subscription order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Pause subscription order
// @route   PUT /api/v1/hotel/subscription-order/:id/pause
// @access  Private
const pauseSubscriptionOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { pauseReason, pauseEndDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription order ID'
      });
    }

    const subscriptionOrder = await SubscriptionOrder.findById(id);
    if (!subscriptionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    if (subscriptionOrder.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active subscription orders can be paused'
      });
    }

    const pauseStartDate = new Date();
    const pauseEnd = pauseEndDate ? new Date(pauseEndDate) : new Date(pauseStartDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // Default 30 days

    subscriptionOrder.status = 'paused';
    subscriptionOrder.pauseStartDate = pauseStartDate;
    subscriptionOrder.pauseEndDate = pauseEnd;
    subscriptionOrder.pauseReason = pauseReason || 'User requested pause';

    subscriptionOrder.subscriptionHistory.push({
      action: 'paused',
      notes: `Subscription paused: ${pauseReason || 'No reason provided'}`
    });

    await subscriptionOrder.save();

    const populatedSubscription = await SubscriptionOrder.findById(subscriptionOrder._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription order paused successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error pausing subscription order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Resume subscription order
// @route   PUT /api/v1/hotel/subscription-order/:id/resume
// @access  Private
const resumeSubscriptionOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription order ID'
      });
    }

    const subscriptionOrder = await SubscriptionOrder.findById(id);
    if (!subscriptionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    if (subscriptionOrder.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Only paused subscription orders can be resumed'
      });
    }

    subscriptionOrder.status = 'active';
    subscriptionOrder.pauseStartDate = null;
    subscriptionOrder.pauseEndDate = null;
    subscriptionOrder.pauseReason = null;

    subscriptionOrder.subscriptionHistory.push({
      action: 'resumed',
      notes: 'Subscription order resumed'
    });

    await subscriptionOrder.save();

    const populatedSubscription = await SubscriptionOrder.findById(subscriptionOrder._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription order resumed successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error resuming subscription order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Cancel subscription order
// @route   PUT /api/v1/hotel/subscription-order/:id/cancel
// @access  Private
const cancelSubscriptionOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription order ID'
      });
    }

    const subscriptionOrder = await SubscriptionOrder.findById(id);
    if (!subscriptionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    if (subscriptionOrder.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Subscription order is already cancelled'
      });
    }

    subscriptionOrder.status = 'cancelled';
    subscriptionOrder.cancellationReason = cancellationReason || 'User requested cancellation';
    subscriptionOrder.cancellationDate = new Date();

    subscriptionOrder.subscriptionHistory.push({
      action: 'cancelled',
      notes: `Subscription cancelled: ${cancellationReason || 'No reason provided'}`
    });

    await subscriptionOrder.save();

    const populatedSubscription = await SubscriptionOrder.findById(subscriptionOrder._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription order cancelled successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error cancelling subscription order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Update subscription order
// @route   PUT /api/v1/hotel/subscription-order/:id
// @access  Private
const updateSubscriptionOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription order ID'
      });
    }

    const subscriptionOrder = await SubscriptionOrder.findById(id);
    if (!subscriptionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['deliveryAddress', 'deliveryInstructions', 'deliveryDays', 'deliveryTime', 'paymentMethod'];
    allowedUpdates.forEach(field => {
      if (updateData[field] !== undefined) {
        subscriptionOrder[field] = updateData[field];
      }
    });

    subscriptionOrder.subscriptionHistory.push({
      action: 'updated',
      notes: 'Subscription order updated'
    });

    await subscriptionOrder.save();

    const populatedSubscription = await SubscriptionOrder.findById(subscriptionOrder._id)
      .populate('userId', 'name mobile email')
      .populate('productId', 'name price image')
      .populate('branchId', 'name address');

    res.status(200).json({
      success: true,
      message: 'Subscription order updated successfully',
      data: populatedSubscription
    });

  } catch (error) {
    console.error('Error updating subscription order:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get subscription order statistics
// @route   GET /api/v1/hotel/subscription-order/stats
// @access  Private/Admin
const getSubscriptionOrderStats = async (req, res) => {
  try {
    const { branchId } = req.query;

    const query = {};
    if (branchId) query.branchId = branchId;

    const totalSubscriptions = await SubscriptionOrder.countDocuments(query);
    const activeSubscriptions = await SubscriptionOrder.countDocuments({ ...query, status: 'active' });
    const pausedSubscriptions = await SubscriptionOrder.countDocuments({ ...query, status: 'paused' });
    const cancelledSubscriptions = await SubscriptionOrder.countDocuments({ ...query, status: 'cancelled' });

    const planTypeStats = await SubscriptionOrder.aggregate([
      { $match: query },
      { $group: { _id: '$planType', count: { $sum: 1 } } }
    ]);

    const monthlyRevenue = await SubscriptionOrder.aggregate([
      { $match: { ...query, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSubscriptions,
        activeSubscriptions,
        pausedSubscriptions,
        cancelledSubscriptions,
        planTypeStats,
        monthlyRevenue: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0
      }
    });

  } catch (error) {
    console.error('Error fetching subscription order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Process recurring orders (CRON job)
// @route   POST /api/v1/hotel/subscription-order/process-recurring
// @access  Private/Admin
const processRecurringOrders = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active subscriptions due for delivery today
    const dueSubscriptions = await SubscriptionOrder.find({
      status: 'active',
      nextDeliveryDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
      }
    }).populate('productId').populate('userId').populate('branchId');

    const processedOrders = [];
    const errors = [];

    for (const subscription of dueSubscriptions) {
      try {
        // Check if product is in stock
        if (subscription.productId.stock <= 0) {
          errors.push({
            subscriptionId: subscription._id,
            productName: subscription.productId.name,
            error: 'Product out of stock'
          });
          continue;
        }

        // Create order for this subscription
        const order = new Order({
          userId: subscription.userId._id,
          branchId: subscription.branchId._id,
          items: [{
            menuItemId: subscription.productId._id,
            quantity: 1,
            price: subscription.price
          }],
          totalAmount: subscription.price,
          status: 'confirmed',
          orderType: 'subscription',
          subscriptionOrderId: subscription._id,
          deliveryAddress: subscription.deliveryAddress,
          deliveryInstructions: subscription.deliveryInstructions,
          deliveryTime: subscription.deliveryTime,
          paymentMethod: subscription.paymentMethod
        });

        await order.save();

        // Update subscription
        subscription.completedCycles += 1;
        
        // Calculate next delivery date
        const nextDelivery = new Date(subscription.nextDeliveryDate);
        switch (subscription.planType) {
          case 'daily':
            nextDelivery.setDate(nextDelivery.getDate() + 1);
            break;
          case 'weekly':
            nextDelivery.setDate(nextDelivery.getDate() + 7);
            break;
          case 'monthly':
            nextDelivery.setMonth(nextDelivery.getMonth() + 1);
            break;
          case 'yearly':
            nextDelivery.setFullYear(nextDelivery.getFullYear() + 1);
            break;
        }
        
        subscription.nextDeliveryDate = nextDelivery;

        // Check if subscription should be completed
        if (subscription.totalCycles && subscription.completedCycles >= subscription.totalCycles) {
          subscription.status = 'completed';
        }

        subscription.subscriptionHistory.push({
          action: 'delivered',
          notes: 'Order delivered via subscription',
          orderId: order._id
        });

        await subscription.save();

        // Reduce product stock
        await Menu.findByIdAndUpdate(subscription.productId._id, {
          $inc: { stock: -1 }
        });

        processedOrders.push({
          subscriptionId: subscription._id,
          orderId: order._id,
          productName: subscription.productId.name,
          customerName: subscription.userId.name
        });

      } catch (error) {
        errors.push({
          subscriptionId: subscription._id,
          productName: subscription.productId.name,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${processedOrders.length} recurring orders`,
      data: {
        processedOrders,
        errors
      }
    });

  } catch (error) {
    console.error('Error processing recurring orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Update delivery status
// @route   PUT /api/v1/hotel/subscription-order/:id/delivery
// @access  Private
const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      scheduledDate, 
      status, 
      deliveryPerson, 
      deliveryNotes, 
      photos, 
      rating, 
      feedback 
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription order ID'
      });
    }

    const subscriptionOrder = await SubscriptionOrder.findById(id);
    if (!subscriptionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    // Find the delivery tracking entry
    const deliveryEntry = subscriptionOrder.deliveryTracking.find(
      entry => entry.scheduledDate.toDateString() === new Date(scheduledDate).toDateString()
    );

    if (deliveryEntry) {
      // Update existing entry
      deliveryEntry.status = status;
      deliveryEntry.actualDeliveryDate = status === 'delivered' ? new Date() : deliveryEntry.actualDeliveryDate;
      deliveryEntry.deliveryPerson = deliveryPerson || deliveryEntry.deliveryPerson;
      deliveryEntry.deliveryNotes = deliveryNotes || deliveryEntry.deliveryNotes;
      deliveryEntry.photos = photos || deliveryEntry.photos;
      deliveryEntry.rating = rating || deliveryEntry.rating;
      deliveryEntry.feedback = feedback || deliveryEntry.feedback;
      deliveryEntry.updatedAt = new Date();
    } else {
      // Create new delivery tracking entry
      subscriptionOrder.deliveryTracking.push({
        scheduledDate: new Date(scheduledDate),
        actualDeliveryDate: status === 'delivered' ? new Date() : null,
        status,
        deliveryPerson,
        deliveryNotes,
        photos: photos || [],
        rating,
        feedback
      });
    }

    // Add to subscription history
    subscriptionOrder.subscriptionHistory.push({
      action: 'delivered',
      date: new Date(),
      notes: `Delivery status updated to: ${status}`
    });

    await subscriptionOrder.save();

    res.status(200).json({
      success: true,
      message: 'Delivery status updated successfully',
      data: subscriptionOrder
    });

  } catch (error) {
    console.error('Error updating delivery status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// @desc    Get delivery tracking for a subscription
// @route   GET /api/v1/hotel/subscription-order/:id/delivery-tracking
// @access  Private
const getDeliveryTracking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription order ID'
      });
    }

    const subscriptionOrder = await SubscriptionOrder.findById(id)
      .populate('productId', 'name price image')
      .populate('userId', 'name mobile email');

    if (!subscriptionOrder) {
      return res.status(404).json({
        success: false,
        message: 'Subscription order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subscription: subscriptionOrder,
        deliveryTracking: subscriptionOrder.deliveryTracking.sort((a, b) => b.scheduledDate - a.scheduledDate)
      }
    });

  } catch (error) {
    console.error('Error fetching delivery tracking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createSubscriptionOrder,
  getUserSubscriptionOrders,
  getAllSubscriptionOrders,
  getSubscriptionOrderById,
  pauseSubscriptionOrder,
  resumeSubscriptionOrder,
  cancelSubscriptionOrder,
  updateSubscriptionOrder,
  getSubscriptionOrderStats,
  processRecurringOrders,
  updateDeliveryStatus,
  getDeliveryTracking
};