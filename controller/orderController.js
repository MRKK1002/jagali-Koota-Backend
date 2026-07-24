const mongoose = require("mongoose") // Add this import
const Order = require("../model/orderModel")
const Cart = require("../model/cartModel")
const User = require("../model/userModel")
const Branch = require("../model/Branch")
const Menu = require("../model/menuModel")
const { validateStock, updateStockAfterOrder } = require("../middleware/stockMiddleware")

// Generate order number with daily reset (format: 001, 002, 003...)
const generateOrderNumber = async () => {
  const today = new Date()
  
  // Find orders created today
  const startOfDay = new Date(today)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)
  
  const todayOrderCount = await Order.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  })
  
  // Generate next order number (001, 002, 003, etc.)
  const sequenceNumber = String(todayOrderCount + 1).padStart(3, '0')
  
  return sequenceNumber
}

// Create a new order
exports.createOrder = async (req, res, next) => {



  try {
    const {
      userId,
      branchId,
      items,
      subtotal,
      discount,
      couponCode,
      tax,
      total,
      deliveryOption,
      deliveryAddress,
      name,
      phone,
      paymentMethod,
      specialInstructions,
    } = req.body

    // Validate required fields
    if (!userId || !branchId || !items || !subtotal || !total || !name || !phone) {
      return res.status(400).json({
        message: "Missing required fields",
        required: "userId, branchId, items, subtotal, total, name, phone",
      })
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Invalid User ID or Branch ID format" })
    }

    // Validate delivery address for delivery option
    if (deliveryOption === "delivery" && !deliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required for delivery orders" })
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items must be a non-empty array" })
    }

    // Enrich items with categoryId and gstRate from Menu model
    const enrichedItems = await Promise.all(items.map(async (item) => {
      if (item.menuItemId) {
        try {
          const menuItem = await Menu.findById(item.menuItemId).select('categoryId gstRate');
          if (menuItem) {
            return { 
              ...item, 
              categoryId: item.categoryId || menuItem.categoryId,
              gstRate: item.gstRate !== undefined ? item.gstRate : (menuItem.gstRate || 0)
            };
          }
        } catch (err) {
          // continue without enrichment
        }
      }
      return item;
    }));

    // Create initial delivery steps
    const deliverySteps = [
      {
        status: "Order Placed",
        time: new Date(),
        completed: true,
      },
    ]

    // Generate order number with daily reset
    const orderNumber = await generateOrderNumber()

    // Create the order with enriched items (including categoryId)
    const order = new Order({
      orderNumber,
      userId,
      branchId,
      items: enrichedItems,
      subtotal,
      discount: discount || 0,
      couponCode,
      tax: tax || 0,
      total,
      deliveryOption: deliveryOption || "delivery",
      deliveryAddress,
      name,
      phone,
      paymentMethod: paymentMethod || "cash",
      specialInstructions,
      deliverySteps,
    })

    // Save the order
    await order.save()

    // Set orderId for stock updates
    req.orderId = order._id;

    // Log the query parameters for debugging

    // Try to find and clear the cart
    let cart = await Cart.findOne({ userId, branchId })
    if (!cart) {
      // Fallback: Try to find any cart for the user (temporary measure)
      cart = await Cart.findOne({ userId })
      if (cart) {
        cart.items = []
        await cart.save()
        return res.status(201).json({
          message: "Order created successfully, cleared cart with different branchId",
          order,
          orderNumber: order.orderNumber,
        })
      }
      return res.status(201).json({
        message: "Order created successfully, but no cart found to clear",
        order,
        orderNumber: order.orderNumber,
      })
    }

    // Clear cart items
    cart.items = []
    await cart.save()

    // Don't send response here - let the stock update middleware handle it
    req.orderResponse = {
      message: "Order created successfully, cart cleared",
      order,
      orderNumber: order.orderNumber,
    }
    next()
  } catch (error) {
    console.error("Error in createOrder:", error)
    res.status(500).json({ message: "Error creating order", error: error.message })
  }
}
// Get all orders for a user
exports.getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20,
      status 
    } = req.query

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" })
    }

    // Build query filter
    const query = { userId: userId }
    
    // Add date range filter
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) {
        query.createdAt.$gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query.createdAt.$lte = end
      }
    }
    
    // Add status filter
    if (status && status !== 'all') {
      query.status = status
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const orders = await Order.find(query)
      .populate("branchId", "name address")
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
    
    const total = await Order.countDocuments(query)
    
    res.status(200).json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message })
  }
}

// Get a single order by ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params

    const order = await Order.findById(id).populate("branchId", "name address").populate("userId", "name mobile")

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    res.status(200).json(order)
  } catch (error) {
    res.status(500).json({ message: "Error fetching order", error: error.message })
  }
}

// Get order by order number
exports.getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params

    const order = await Order.findOne({ orderNumber })
      .populate("branchId", "name address")
      .populate("userId", "name mobile")

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    res.status(200).json(order)
  } catch (error) {
    res.status(500).json({ message: "Error fetching order", error: error.message })
  }
}

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, cancellationReason } = req.body


    if (!status) {
      return res.status(400).json({ message: "Status is required" })
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order ID format" })
    }

    const validStatuses = ["pending", "confirmed", "preparing", "out for delivery", "delivered", "cancelled"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
        validStatuses,
      })
    }

    const order = await Order.findById(id)
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }


    // Add to delivery steps if status is changing
    if (order.status !== status) {
      const newStep = {
        status: status.charAt(0).toUpperCase() + status.slice(1),
        time: new Date(),
        completed: true,
      }

      order.deliverySteps.push(newStep)
    }

    // If cancelling, require a reason
    if (status === "cancelled" && !cancellationReason) {
      return res.status(400).json({ message: "Cancellation reason is required when cancelling an order" })
    }

    // Update order
    order.status = status
    if (status === "cancelled" && cancellationReason) {
      order.cancellationReason = cancellationReason
    }

    const savedOrder = await order.save()

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order: savedOrder,
    })
  } catch (error) {
    console.error("Error updating order status:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
}

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { paymentStatus } = req.body


    if (!paymentStatus) {
      return res.status(400).json({ message: "Payment status is required" })
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order ID format" })
    }

    const validPaymentStatuses = ["pending", "completed", "failed", "refunded"]
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        message: "Invalid payment status",
        validPaymentStatuses,
      })
    }

    const order = await Order.findById(id)
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }


    // Update payment status
    order.paymentStatus = paymentStatus

    const savedOrder = await order.save()

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      order: savedOrder,
    })
  } catch (error) {
    console.error("Error updating payment status:", error)
    console.error("Error stack:", error.stack)
    res.status(500).json({
      success: false,
      message: "Error updating payment status",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
}

// Get orders for a branch
exports.getBranchOrders = async (req, res) => {
  try {
    const { branchId } = req.params
    const { status } = req.query

    if (!branchId) {
      return res.status(400).json({ message: "Branch ID is required" })
    }

    const query = { branchId }

    // Filter by status if provided
    if (status) {
      query.status = status
    }

    const orders = await Order.find(query).populate("userId", "name mobile").sort({ createdAt: -1 })

    res.status(200).json(orders)
  } catch (error) {
    res.status(500).json({ message: "Error fetching branch orders", error: error.message })
  }
}

// Get order statistics
exports.getOrderStats = async (req, res) => {
  try {
    const { branchId } = req.query

    const query = {}
    if (branchId) {
      query.branchId = branchId
    }

    // Get counts by status
    const statusCounts = await Order.aggregate([{ $match: query }, { $group: { _id: "$status", count: { $sum: 1 } } }])

    // Get total revenue
    const revenue = await Order.aggregate([
      { $match: { ...query, status: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ])

    // Get today's orders
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayOrders = await Order.countDocuments({
      ...query,
      createdAt: { $gte: today },
    })

    // Format status counts into an object
    const statusMap = {}
    statusCounts.forEach((item) => {
      statusMap[item._id] = item.count
    })

    res.status(200).json({
      totalOrders: await Order.countDocuments(query),
      todayOrders,
      revenue: revenue.length > 0 ? revenue[0].total : 0,
      statusCounts: statusMap,
    })
  } catch (error) {
    res.status(500).json({ message: "Error fetching order statistics", error: error.message })
  }
}

// Get all orders (admin only)
exports.getAllOrders = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      status,
      branchId,
      categoryId,
      userId,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "desc",
      search = "", // Add search parameter
    } = req.query


    // Build the query object
    const query = {}

    if (status) {
      query.status = status
    }

    if (branchId) {
      if (!mongoose.Types.ObjectId.isValid(branchId)) {
        return res.status(400).json({ message: "Invalid Branch ID format" })
      }
      query.branchId = branchId
    }

    if (categoryId) {
      // Filter orders that have items with this categoryId
      query["items.categoryId"] = categoryId
    }

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid User ID format" })
      }
      query.userId = userId
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) {
        // Start of the selected day in local time
        const start = new Date(fromDate)
        start.setHours(0, 0, 0, 0)
        query.createdAt.$gte = start
      }
      if (toDate) {
        // End of the selected day - use next day at 00:00:00 for $lt
        const end = new Date(toDate)
        end.setDate(end.getDate() + 1)
        end.setHours(0, 0, 0, 0)
        query.createdAt.$lt = end
      } else if (fromDate) {
        // Single date filter - use end of that day
        const end = new Date(fromDate)
        end.setDate(end.getDate() + 1)
        end.setHours(0, 0, 0, 0)
        query.createdAt.$lt = end
      }
    }

    // Add search functionality
    if (search && search.trim() !== "") {
      // Create a search regex for case-insensitive search
      const searchRegex = new RegExp(search.trim(), "i")

      // Search in multiple fields using $or operator
      query.$or = [{ orderNumber: searchRegex }, { name: searchRegex }, { phone: searchRegex }, { email: searchRegex }]
    }

    // Sort options
    const sortOptions = {}
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1

    // Execute query with pagination
    const orders = await Order.find(query)
      .populate("branchId", "name address")
      .populate("userId", "name email mobile")
      .sort(sortOptions)
      .limit(Number.parseInt(limit))
      .skip((Number.parseInt(page) - 1) * Number.parseInt(limit))


    // Get total count for pagination info
    const total = await Order.countDocuments(query)

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error in getAllOrders:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    })
  }
}

// Delete a single order
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid order ID format" })
    }

    const order = await Order.findById(id)
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    await Order.findByIdAndDelete(id)

    res.status(200).json({
      success: true,
      message: "Order deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting order:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: error.message
    })
  }
}

// Bulk delete orders (for clearing old test data)
exports.bulkDeleteOrders = async (req, res) => {
  try {
    const { orderIds, deleteAll, beforeDate } = req.body

    let deleteQuery = {}

    if (deleteAll) {
      // Delete all orders
      deleteQuery = {}
    } else if (beforeDate) {
      // Delete orders before a specific date
      deleteQuery = { createdAt: { $lt: new Date(beforeDate) } }
    } else if (orderIds && Array.isArray(orderIds)) {
      // Delete specific orders by IDs
      deleteQuery = { _id: { $in: orderIds } }
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide orderIds, set deleteAll to true, or provide beforeDate"
      })
    }

    const result = await Order.deleteMany(deleteQuery)

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} orders`,
      deletedCount: result.deletedCount
    })
  } catch (error) {
    console.error("Error in bulk delete orders:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting orders",
      error: error.message
    })
  }
}