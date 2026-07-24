const PublicRestaurantOrder = require('../model/publicRestaurantOrderModel');

// Generate unique order ID (3-digit sequence, resets daily)
const generateOrderId = async () => {
  const today = new Date();
  const todayStr = today.toDateString(); // Get today's date as string for comparison

  // Find the last order created today
  const lastOrder = await PublicRestaurantOrder.findOne({
    createdAt: {
      $gte: new Date(today.setHours(0, 0, 0, 0)),
      $lt: new Date(today.setHours(23, 59, 59, 999))
    }
  }).sort({ createdAt: -1 });

  let sequence = 1;
  if (lastOrder) {
    // Extract sequence number from last order
    const lastSequence = parseInt(lastOrder.orderId);
    sequence = lastSequence + 1;
  }

  return String(sequence).padStart(3, '0');
};

// Create new public restaurant order
exports.createPublicOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerMobile,
      peopleCount,
      branchId,
      branchName,
      tableId,
      tableNumber,
      categoryId,
      categoryName,
      sessionId,
      items,
      totalAmount,
      paymentMethod,
      notes
    } = req.body;

    // Validation
    if (!customerName || !customerMobile) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and mobile number are required'
      });
    }

    if (!branchId || !tableNumber) {
      return res.status(400).json({
        success: false,
        message: 'Branch and table information are required'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Validate mobile number (10 digits)
    if (!/^\d{10}$/.test(customerMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must be 10 digits'
      });
    }

    // Generate unique order ID
    const orderId = await generateOrderId();

    // Calculate total from items (no tax, no service charge)
    const calculatedTotal = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // Create order
    const newOrder = new PublicRestaurantOrder({
      orderId,
      customerName,
      customerMobile,
      peopleCount: peopleCount || 1,
      branchId,
      branchName,
      tableId,
      tableNumber,
      categoryId,
      categoryName,
      sessionId, // Store session ID
      items,
      totalAmount: calculatedTotal,
      paymentMethod: paymentMethod || 'pending',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      notes,
      isGuestOrder: true,
      orderTime: new Date()
    });

    await newOrder.save();

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId: newOrder.orderId,
        orderTime: newOrder.orderTime,
        totalAmount: newOrder.totalAmount,
        customerName: newOrder.customerName,
        tableNumber: newOrder.tableNumber
      }
    });

  } catch (error) {
    console.error('Error creating public restaurant order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to place order',
      error: error.message
    });
  }
};

// Get all public orders (for admin/staff)
exports.getAllPublicOrders = async (req, res) => {
  try {
    const { branchId, startDate, endDate, singleDate, status, paymentMethod, search, page = 1, limit = 10 } = req.query;

    let query = {};

    if (branchId) {
      query.branchId = branchId;
    }

    if (status) {
      query.orderStatus = status;
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Date filter - single date takes precedence over date range
    if (singleDate) {
      const startOfDay = new Date(singleDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(singleDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      query.orderTime = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    } else if (startDate || endDate) {
      query.orderTime = {};
      if (startDate) {
        query.orderTime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.orderTime.$lte = new Date(endDate);
      }
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { orderId: searchRegex },
        { customerName: searchRegex },
        { customerMobile: searchRegex },
        { tableNumber: searchRegex },
        { sessionId: searchRegex }
      ];
    }

    // Get total count for pagination
    let totalCount = 0;
    try {
      totalCount = await PublicRestaurantOrder.countDocuments(query);
    } catch (countError) {
      console.error('Error counting documents:', countError);
      // Fallback: count manually if countDocuments fails
      totalCount = await PublicRestaurantOrder.find(query).countDocuments();
    }
    
    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;
    
    // Don't populate, just return the data as-is since we store branchName directly
    let orders = [];
    try {
      orders = await PublicRestaurantOrder.find(query)
        .sort({ orderTime: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();
    } catch (findError) {
      console.error('Error finding orders:', findError);
      orders = [];
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      data: orders
    });

  } catch (error) {
    console.error('Error fetching public orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Don't populate, just return the data as-is since we store branchName directly
    const order = await PublicRestaurantOrder.findOne({ orderId })
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, paymentStatus, paymentMethod } = req.body;

    const updateData = {};
    if (orderStatus) updateData.orderStatus = orderStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;

    const order = await PublicRestaurantOrder.findOneAndUpdate(
      { orderId },
      updateData,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });

  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
};

// Get orders by customer mobile
exports.getOrdersByMobile = async (req, res) => {
  try {
    const { mobile } = req.params;

    // Don't populate, just return the data as-is since we store branchName directly
    const orders = await PublicRestaurantOrder.find({ customerMobile: mobile })
      .sort({ orderTime: -1 })
      .limit(10)
      .lean();

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });

  } catch (error) {
    console.error('Error fetching orders by mobile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get orders by session ID
exports.getOrdersBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const orders = await PublicRestaurantOrder.find({ sessionId })
      .sort({ orderTime: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });

  } catch (error) {
    console.error('Error fetching orders by session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};