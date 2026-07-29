const StaffOrder = require("../model/staffOrderModel")
const StaffLogin = require("../model/staffLoginModel")
const mongoose = require("mongoose")

// Create a new staff order after payment success (EXISTING - UPDATED)
exports.createStaffOrderAfterPayment = async (req, res) => {
  try {
    const {
      userId, // Add userId to destructuring
      restaurant,
      table,
      peopleCount,
      cart,
      totalAmount,
      orderId,
      orderTime,
      grandTotal,
      paymentMethod,
      notes,
      branchId,
      tableId,
      categoryId, // Add categoryId
      categoryName, // Add categoryName
    } = req.body


    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required for staff orders",
      })
    }

    // Verify user exists
    const user = await StaffLogin.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Validate required fields
    if (!restaurant || !restaurant.name) {
      return res.status(400).json({
        success: false,
        message: "Restaurant/Branch information is required",
      })
    }

    if (!table || !table.number) {
      return res.status(400).json({
        success: false,
        message: "Table information is required",
      })
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item",
      })
    }

    // orderId is now auto-generated if not provided

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      })
    }

    // Check if order already exists (only if orderId is provided)
    if (orderId) {
      const existingOrder = await StaffOrder.findOne({ orderId })
      if (existingOrder) {
        return res.status(200).json({
          success: true,
          message: "Order already exists",
          order: existingOrder,
        })
      }
    }

    // Process cart items
    const orderItems = cart.map((item) => ({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      gstRate: item.gstRate || 0, // Include GST rate per item
      quantity: item.quantity,
      image: item.image || "",
      description: item.description || "",
      categoryId: item.categoryId || categoryId, // Add categoryId to items
    }))

    // Calculate totals
    const subtotal = totalAmount
    const tax = subtotal * 0.05 // 5% tax
    const serviceCharge = subtotal * 0.1 // 10% service charge
    const calculatedGrandTotal = subtotal + tax + serviceCharge

    // Prepare order data
    const orderData = {
      userId, // Include userId in order data
      orderId: orderId || `STAFF-${Date.now()}`, // Temporary ID, will be replaced by pre-save hook
      branchName: restaurant.name,
      categoryId: categoryId, // Add categoryId
      categoryName: categoryName, // Add categoryName
      tableNumber: table.number.toString(),
      peopleCount,
      items: orderItems,
      subtotal,
      tax,
      serviceCharge,
      totalAmount: subtotal,
      grandTotal: grandTotal || calculatedGrandTotal,
      paymentStatus: "completed",
      paymentMethod,
      orderTime: new Date(orderTime),
      notes: notes || "",
      status: "pending",
      isGuestOrder: false, // This is a staff order
    }

    // Add IDs if provided by frontend
    if (branchId) {
      orderData.branchId = branchId
    } else {
      orderData.branchId = new mongoose.Types.ObjectId()
    }

    if (tableId) {
      orderData.tableId = tableId
    } else {
      orderData.tableId = new mongoose.Types.ObjectId()
    }

    // Create the staff order
    const staffOrder = new StaffOrder(orderData)
    await staffOrder.save()

    // Set orderId for stock updates
    req.orderId = staffOrder._id

    // 🔥 WEBHOOK: Call CRM backend to deduct department stock based on recipes
    try {
      const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:9001";
      const axios = require("axios");
      await axios.post(`${CRM_API_URL}/api/v1/hotel/department-stock/deduct-by-recipe`, {
        items: staffOrder.items.map(item => ({
          menuItemId: item.menuItemId,
          menuItemName: item.name,
          quantity: item.quantity,
        })),
        department: "Kitchen", // Default department
        branch: staffOrder.branchName || "MYSURU",
        orderId: String(staffOrder._id),
        orderNumber: staffOrder.orderId,
      });
      console.log("✅ CRM stock deduction webhook sent for order:", staffOrder.orderId);
    } catch (webhookErr) {
      console.error("⚠️ CRM webhook failed (non-blocking):", webhookErr.message);
      // Don't fail the order if webhook fails
    }


    res.status(201).json({
      success: true,
      message: "Staff order created successfully",
      order: staffOrder,
    })
  } catch (error) {
    console.error("Error creating staff order after payment:", error)
    res.status(500).json({
      success: false,
      message: "Error creating staff order after payment",
      error: error.message,
    })
  }
}

// NEW: Create a guest order
exports.createGuestOrder = async (req, res) => {
  try {
    const {
      orderId,
      customerName,
      customerMobile,
      branchId,
      branchName,
      categoryId,
      categoryName,
      tableNumber,
      peopleCount,
      items,
      subtotal,
      tax,
      serviceCharge,
      totalAmount,
      grandTotal,
      paymentMethod,
      paymentStatus,
      status,
      orderTime,
      notes,
    } = req.body


    // Validate required fields for guest orders
    // orderId is now auto-generated if not provided

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      })
    }

    if (!customerMobile || !customerMobile.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer mobile is required",
      })
    }

    // Validate mobile number format
    if (!/^[0-9]{10}$/.test(customerMobile.trim())) {
      return res.status(400).json({
        success: false,
        message: "Mobile number must be 10 digits",
      })
    }

    if (!branchId || !branchName) {
      return res.status(400).json({
        success: false,
        message: "Branch information is required",
      })
    }

    if (!tableNumber) {
      return res.status(400).json({
        success: false,
        message: "Table number is required",
      })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item",
      })
    }

    // Check if order already exists (only if orderId is provided)
    if (orderId) {
      const existingOrder = await StaffOrder.findOne({ orderId })
      if (existingOrder) {
        return res.status(200).json({
          success: true,
          message: "Order already exists",
          order: existingOrder,
        })
      }
    }

    // Import Table model
    const Table = require("../model/Table")

    // Use the tableId from request if provided, otherwise try to find by table number
    let tableId = req.body.tableId || new mongoose.Types.ObjectId()
    
    try {
      if (req.body.tableId) {
        // If tableId is provided, use it directly and reserve the table
        
        const table = await Table.findById(req.body.tableId)
        if (table) {
          // Reserve the table when order is created
          await Table.findByIdAndUpdate(
            req.body.tableId, 
            { status: "reserved" }, 
            { new: true }
          )
          tableId = req.body.tableId
        } else {
        }
      } else {
        // Fallback: Try to find table by branch and number (string comparison)
        const table = await Table.findOne({
          branchId: branchId,
          number: tableNumber, // Use string comparison, not parseInt
        })

        if (table) {
          tableId = table._id
          
          // Reserve the table
          await Table.findByIdAndUpdate(
            tableId, 
            { status: "reserved" }, 
            { new: true }
          )
        } else {
        }
      }
    } catch (tableError) {
      console.error("❌ Error finding/updating table:", tableError)
      // Continue with generated tableId
    }

    // Generate initial KOT number using global counter
    const KotCounter = require("../model/kotCounterModel")
    const initialKotNumber = await KotCounter.getNextKotNumber(branchId)
    const kotGeneratedAt = new Date()
    
    
    // Add KOT information to each item
    const itemsWithKot = items.map(item => ({
      ...item,
      kotNumber: initialKotNumber,
      kotGeneratedAt: kotGeneratedAt,
      isNewItem: true,
    }))

    // Create the guest order using StaffOrder model
    // Note: orderId will be auto-generated by the model's pre-save hook based on branch and category
    const guestOrder = new StaffOrder({
      orderId: orderId || `GUEST-${Date.now()}`, // Temporary ID, will be replaced by pre-save hook
      customerName: customerName.trim(),
      customerMobile: customerMobile.trim(),
      branchId: branchId,
      branchName,
      categoryId: categoryId,
      categoryName: categoryName,
      tableId: tableId,
      tableNumber,
      peopleCount: Number.parseInt(peopleCount) || 1,
      items: itemsWithKot,
      subtotal: Number.parseFloat(subtotal) || 0,
      tax: Number.parseFloat(tax) || 0,
      serviceCharge: Number.parseFloat(serviceCharge) || 0,
      totalAmount: Number.parseFloat(totalAmount) || 0,
      grandTotal: Number.parseFloat(grandTotal) || 0,
      paymentMethod: paymentMethod || "cash",
      paymentStatus: paymentStatus || "pending", // Use provided paymentStatus or default to pending
      orderTime: new Date(orderTime) || new Date(),
      notes: notes || `Guest order from Table ${tableNumber}`,
      status: status || "pending", // Use provided status or default to pending
      isGuestOrder: true, // Mark as guest order
      kotCounter: 1, // First KOT for this order
      kots: [{
        kotNumber: initialKotNumber,
        items: items.map(item => item.name),
        generatedAt: kotGeneratedAt,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      }],
    })

    await guestOrder.save()

    // Set orderId for stock updates
    req.orderId = guestOrder._id


    res.status(201).json({
      success: true,
      message: "Guest order created successfully",
      order: guestOrder,
    })
  } catch (error) {
    console.error("Error creating guest order:", error)
    res.status(500).json({
      success: false,
      message: "Error creating guest order",
      error: error.message,
    })
  }
}

// Get orders by userId - EXISTING FUNCTION
exports.getOrdersByUserId = async (req, res) => {
  try {
    const { userId } = req.params


    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      })
    }

    // Verify user exists
    const user = await StaffLogin.findById(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }


    const orders = await StaffOrder.find({ userId, isGuestOrder: false }) // Only staff orders
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile") // Populate user details
      .sort({ createdAt: -1 })


    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
      user: {
        name: user.name,
        mobile: user.mobile,
      },
    })
  } catch (error) {
    console.error("Error fetching user orders:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    })
  }
}

// Get available status values from database
exports.getAvailableStatuses = async (req, res) => {
  try {
    // Get distinct status values from orders
    const orderStatuses = await StaffOrder.distinct("status")
    const paymentStatuses = await StaffOrder.distinct("paymentStatus")
    
    // Filter out null/undefined values and sort
    const validOrderStatuses = orderStatuses.filter(status => status && status.trim()).sort()
    const validPaymentStatuses = paymentStatuses.filter(status => status && status.trim()).sort()
    
    res.status(200).json({
      success: true,
      orderStatuses: validOrderStatuses,
      paymentStatuses: validPaymentStatuses,
    })
  } catch (error) {
    console.error("Error fetching available statuses:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching available statuses",
      error: error.message,
    })
  }
}

// Get all orders (both staff and guest) - UPDATED FUNCTION
exports.getAllStaffOrders = async (req, res) => {
  try {
    const { branchId, branchName, tableId, tableNumber, status, paymentStatus, userId, search, orderType, startDate, endDate, page = 1, limit = 50 } = req.query

    // Build filter based on query parameters
    const filter = {}
    if (branchId) filter.branchId = branchId
    if (branchName) filter.branchName = new RegExp(branchName, "i")
    if (tableId) filter.tableId = tableId
    if (tableNumber) filter.tableNumber = tableNumber
    if (status) filter.status = status
    if (paymentStatus) filter.paymentStatus = paymentStatus
    if (userId) filter.userId = userId
    
    // NEW: Filter by category (for category-based order screens)
    const { categoryId, categoryName } = req.query
    if (categoryId) filter.categoryId = categoryId
    if (categoryName) filter.categoryName = new RegExp(categoryName, "i")

    // NEW: Filter by order type
    if (orderType === "staff") {
      filter.isGuestOrder = false
    } else if (orderType === "guest") {
      filter.isGuestOrder = true
    }
    // If orderType is "all" or not specified, don't add filter

    // NEW: Date range filter
    if (startDate || endDate) {
      filter.orderTime = {}
      if (startDate) {
        filter.orderTime.$gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999) // Include the entire end date
        filter.orderTime.$lte = endDateTime
      }
    }

    // Add search functionality
    if (search) {
      const searchRegex = new RegExp(search, "i")
      filter.$or = [
        { orderId: searchRegex },
        { tableNumber: searchRegex },
        { branchName: searchRegex },
        { customerName: searchRegex }, // NEW: Search guest customer names
        { customerMobile: searchRegex }, // NEW: Search guest mobile numbers
      ]
    }

    // Calculate pagination
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Get total count for pagination
    const totalCount = await StaffOrder.countDocuments(filter)

    const staffOrders = await StaffOrder.find(filter)
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile") // This will be null for guest orders
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)

    res.status(200).json({
      success: true,
      count: staffOrders.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      orders: staffOrders,
    })
  } catch (error) {
    console.error("Error fetching orders:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    })
  }
}

// Get a staff order by ID - EXISTING FUNCTION
exports.getStaffOrderById = async (req, res) => {
  try {
    const staffOrder = await StaffOrder.findById(req.params.id)
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")

    if (!staffOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }
    res.status(200).json({
      success: true,
      order: staffOrder,
    })
  } catch (error) {
    console.error("Error fetching order:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: error.message,
    })
  }
}

// Get staff order by orderId - EXISTING FUNCTION
exports.getStaffOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params

    const staffOrder = await StaffOrder.findOne({ orderId })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")

    if (!staffOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }


    res.status(200).json({
      success: true,
      order: staffOrder,
    })
  } catch (error) {
    console.error("Error fetching order by orderId:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: error.message,
    })
  }
}

// Update a staff order status - EXISTING FUNCTION (works for both staff and guest orders)
exports.updateStaffOrderStatus = async (req, res) => {
  try {
    const { status, paymentStatus, paymentMethod, notes, billPrinted, billPrintedAt } = req.body


    const updateData = {}
    if (status) updateData.status = status
    if (paymentStatus) updateData.paymentStatus = paymentStatus
    if (paymentMethod) updateData.paymentMethod = paymentMethod
    if (notes !== undefined) updateData.notes = notes
    if (billPrinted !== undefined) {
      updateData.billPrinted = billPrinted
      if (billPrintedAt) {
        updateData.billPrintedAt = new Date(billPrintedAt)
      } else if (billPrinted) {
        updateData.billPrintedAt = new Date()
      }
    }

    // Validate order status if provided
    if (status) {
      const validOrderStatuses = ["pending", "preparing", "served", "completed", "cancelled"]
      if (!validOrderStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status. Valid statuses are: " + validOrderStatuses.join(", "),
        })
      }
    }

    // Validate payment status if provided
    if (paymentStatus) {
      const validPaymentStatuses = ["pending", "completed", "failed", "refunded"]
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status. Valid statuses are: " + validPaymentStatuses.join(", "),
        })
      }
    }

    // Validate payment method if provided
    if (paymentMethod) {
      const validPaymentMethods = ["card", "upi", "netbanking", "cash", "wallet"]
      if (!validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment method",
        })
      }
    }

    // Find the order first to log current status
    const currentOrder = await StaffOrder.findById(req.params.id)
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }


    const staffOrder = await StaffOrder.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")


    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order: staffOrder,
      previousStatus: {
        status: currentOrder.status,
        paymentStatus: currentOrder.paymentStatus
      },
      newStatus: {
        status: staffOrder.status,
        paymentStatus: staffOrder.paymentStatus
      }
    })
  } catch (error) {
    console.error("Error updating order:", error)
    res.status(400).json({
      success: false,
      message: "Error updating order",
      error: error.message,
    })
  }
}

// Delete a staff order - EXISTING FUNCTION (works for both staff and guest orders)
exports.deleteStaffOrder = async (req, res) => {
  try {
    const staffOrder = await StaffOrder.findById(req.params.id)

    if (!staffOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    // Only allow deletion of pending orders
    if (staffOrder.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be deleted",
      })
    }

    await StaffOrder.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting order:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: error.message,
    })
  }
}

// Bulk delete staff orders - NEW FUNCTION (for clearing old data)
exports.bulkDeleteStaffOrders = async (req, res) => {
  try {
    
    // Delete ALL staff orders (no restrictions for admin cleanup)
    const result = await StaffOrder.deleteMany({})
    

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} orders`,
      deletedCount: result.deletedCount
    })
  } catch (error) {
    console.error("Error in bulk delete staff orders:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting orders",
      error: error.message
    })
  }
}

// Add items to an existing staff order - EXISTING FUNCTION (UPDATED FOR KOT)
exports.addItemsToStaffOrder = async (req, res) => {
  try {
    const { items } = req.body

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request must contain at least one item",
      })
    }

    // Find the staff order
    const staffOrder = await StaffOrder.findById(req.params.id)
    if (!staffOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    // Only allow adding items to pending or preparing orders
    if (!["pending", "preparing"].includes(staffOrder.status)) {
      return res.status(400).json({
        success: false,
        message: "Items can only be added to pending or preparing orders",
      })
    }

    // Generate new KOT number using global counter
    const KotCounter = require("../model/kotCounterModel")
    const newKotNumber = await KotCounter.getNextKotNumber(staffOrder.branchId)
    const kotGeneratedAt = new Date()
    

    // Track newly added items for KOT
    const newlyAddedItems = []

    // Process each new item - ALWAYS create new entries with new KOT
    // Don't merge with existing items, even if they're the same
    for (const item of items) {
      const newItem = {
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || "",
        description: item.description || "",
        kotNumber: newKotNumber,
        kotGeneratedAt: kotGeneratedAt,
        isNewItem: true,
      }
      
      // Always add as a new item entry with the new KOT number
      // This ensures each reorder gets its own KOT, even for duplicate items
      staffOrder.items.push(newItem)
      newlyAddedItems.push(item.name)
      
      
      // Update subtotal
      staffOrder.subtotal += item.price * item.quantity
    }

    // Increment order's KOT counter
    const kotCounter = (staffOrder.kotCounter || 0) + 1
    staffOrder.kotCounter = kotCounter
    
    
    // Add KOT record to order
    if (!staffOrder.kots) {
      staffOrder.kots = []
    }
    staffOrder.kots.push({
      kotNumber: newKotNumber,
      items: newlyAddedItems,
      generatedAt: kotGeneratedAt,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    })


    // Recalculate tax, service charge, and total
    staffOrder.tax = staffOrder.subtotal * 0.05
    staffOrder.serviceCharge = staffOrder.subtotal * 0.1
    staffOrder.totalAmount = staffOrder.subtotal
    staffOrder.grandTotal = staffOrder.subtotal + staffOrder.tax + staffOrder.serviceCharge

    // Mark items array as modified to ensure MongoDB saves it
    staffOrder.markModified('items')
    staffOrder.markModified('kots')
    
    await staffOrder.save()


    res.status(200).json({
      success: true,
      message: "Items added to order successfully",
      order: staffOrder,
      newKotNumber: newKotNumber, // Return the new KOT number
    })
  } catch (error) {
    console.error("Error adding items to order:", error)
    res.status(400).json({
      success: false,
      message: "Error adding items to order",
      error: error.message,
    })
  }
}

// Get staff orders by branch and table - EXISTING FUNCTION
exports.getStaffOrdersByTable = async (req, res) => {
  try {
    const { branchId, tableId } = req.params

    const filter = {
      status: { $in: ["pending", "preparing", "served"] },
    }

    if (branchId) filter.branchId = branchId
    if (tableId) filter.tableId = tableId

    const staffOrders = await StaffOrder.find(filter)
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: staffOrders.length,
      orders: staffOrders,
    })
  } catch (error) {
    console.error("Error fetching orders for table:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching orders for table",
      error: error.message,
    })
  }
}

// Get orders by payment status - EXISTING FUNCTION
exports.getOrdersByPaymentStatus = async (req, res) => {
  try {
    const { paymentStatus } = req.params

    const orders = await StaffOrder.find({ paymentStatus })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    })
  } catch (error) {
    console.error("Error fetching orders by payment status:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching orders by payment status",
      error: error.message,
    })
  }
}

// Get orders by branch - EXISTING FUNCTION
exports.getOrdersByBranch = async (req, res) => {
  try {
    const { branchId } = req.params
    const { status, paymentStatus, userId, orderType } = req.query

    const filter = { branchId }
    if (status) filter.status = status
    if (paymentStatus) filter.paymentStatus = paymentStatus
    if (userId) filter.userId = userId

    // NEW: Filter by order type
    if (orderType === "staff") {
      filter.isGuestOrder = false
    } else if (orderType === "guest") {
      filter.isGuestOrder = true
    }

    const orders = await StaffOrder.find(filter)
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    })
  } catch (error) {
    console.error("Error fetching orders by branch:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching orders by branch",
      error: error.message,
    })
  }
}

// Get order statistics - UPDATED FUNCTION
exports.getOrderStatistics = async (req, res) => {
  try {
    const { branchId, userId, orderType } = req.query

    const matchFilter = {}
    if (branchId) matchFilter.branchId = new mongoose.Types.ObjectId(branchId)
    if (userId) matchFilter.userId = new mongoose.Types.ObjectId(userId)

    // NEW: Filter by order type
    if (orderType === "staff") {
      matchFilter.isGuestOrder = false
    } else if (orderType === "guest") {
      matchFilter.isGuestOrder = true
    }

    const stats = await StaffOrder.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$grandTotal" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          staffOrders: {
            $sum: { $cond: [{ $eq: ["$isGuestOrder", false] }, 1, 0] },
          },
          guestOrders: {
            $sum: { $cond: [{ $eq: ["$isGuestOrder", true] }, 1, 0] },
          },
          averageOrderValue: { $avg: "$grandTotal" },
        },
      },
    ])

    const paymentStats = await StaffOrder.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" },
        },
      },
    ])

    const branchStats = await StaffOrder.aggregate([
      { $match: userId ? { userId: new mongoose.Types.ObjectId(userId) } : {} },
      {
        $group: {
          _id: "$branchId",
          branchName: { $first: "$branchName" },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$grandTotal" },
          staffOrders: {
            $sum: { $cond: [{ $eq: ["$isGuestOrder", false] }, 1, 0] },
          },
          guestOrders: {
            $sum: { $cond: [{ $eq: ["$isGuestOrder", true] }, 1, 0] },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ])

    res.status(200).json({
      success: true,
      statistics: stats[0] || {},
      paymentMethodStats: paymentStats,
      branchStats,
    })
  } catch (error) {
    console.error("Error fetching order statistics:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching order statistics",
      error: error.message,
    })
  }
}

// NEW: Get guest orders by mobile number
exports.getGuestOrdersByMobile = async (req, res) => {
  try {
    const { mobile } = req.params

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit mobile number is required",
      })
    }

    const orders = await StaffOrder.find({
      customerMobile: mobile,
      isGuestOrder: true,
    })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    })
  } catch (error) {
    console.error("Error fetching guest orders by mobile:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching guest orders by mobile",
      error: error.message,
    })
  }
}

// Mark order as complimentary with reason
exports.markOrderAsComplimentary = async (req, res) => {
  
  try {
    const { id } = req.params
    const { reason } = req.body


    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason is required for complimentary bill",
      })
    }

    const order = await StaffOrder.findById(id)
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    order.isComplimentary = true
    order.complimentaryReason = reason.trim()
    order.originalGrandTotal = order.grandTotal
    order.grandTotal = 0
    order.paymentStatus = "completed"
    order.complimentaryMarkedAt = new Date()

    await order.save()


    res.status(200).json({
      success: true,
      message: "Order marked as complimentary",
      order: order,
    })
  } catch (error) {
    console.error("❌ Complimentary - Error:", error)
    res.status(500).json({
      success: false,
      message: "Error marking order as complimentary",
      error: error.message,
    })
  }
}

// Cancel order with reason
exports.cancelOrder = async (req, res) => {
  
  try {
    const { id } = req.params
    const { reason, cancelledBy } = req.body


    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason is required for cancelling order",
      })
    }

    const order = await StaffOrder.findById(id)
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    order.status = "cancelled"
    order.cancellationReason = reason.trim()
    order.cancelledBy = cancelledBy ? cancelledBy.trim() : "Admin"
    order.cancelledAt = new Date()
    
    // If there's a table, mark it as available
    if (order.tableId) {
      try {
        const Table = require("../model/Table")
        await Table.findByIdAndUpdate(
          order.tableId,
          { status: "available" },
          { new: true }
        )
      } catch (tableError) {
        console.error("❌ Error updating table status:", tableError)
      }
    }

    await order.save()


    res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order: order,
    })
  } catch (error) {
    console.error("❌ Cancel - Error:", error)
    res.status(500).json({
      success: false,
      message: "Error cancelling order",
      error: error.message,
    })
  }
}

// Apply discount to order
exports.applyDiscount = async (req, res) => {
  
  try {
    const { id } = req.params
    const { discountType, discountValue, reason } = req.body


    if (!discountType || !["percentage", "amount"].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: "Discount type must be 'percentage' or 'amount'",
      })
    }

    if (!discountValue || discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0",
      })
    }

    const order = await StaffOrder.findById(id)
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    if (!order.originalGrandTotal) {
      order.originalGrandTotal = order.grandTotal
    }

    let discountAmount = 0
    if (discountType === "percentage") {
      if (discountValue > 100) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount cannot exceed 100%",
        })
      }
      discountAmount = (order.originalGrandTotal * discountValue) / 100
    } else {
      discountAmount = discountValue
      if (discountAmount > order.originalGrandTotal) {
        return res.status(400).json({
          success: false,
          message: "Discount amount cannot exceed order total",
        })
      }
    }

    order.discountType = discountType
    order.discountValue = discountValue
    order.discountAmount = discountAmount
    order.discountReason = reason || "Discount applied"
    order.grandTotal = order.originalGrandTotal - discountAmount
    order.discountAppliedAt = new Date()

    await order.save()


    res.status(200).json({
      success: true,
      message: "Discount applied successfully",
      order: order,
      discountAmount: discountAmount,
    })
  } catch (error) {
    console.error("❌ Discount - Error:", error)
    res.status(500).json({
      success: false,
      message: "Error applying discount",
      error: error.message,
    })
  }
}


// Update table number for an order
exports.updateOrderTableNumber = async (req, res) => {
  try {
    
    const { tableNumber } = req.body
    
    // Validate table number
    if (!tableNumber || tableNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "Valid table number is required"
      })
    }
    
    // Find the order
    const order = await StaffOrder.findById(req.params.id)
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      })
    }
    
    // Store old table info for logging and status update
    const oldTableNumber = order.tableNumber
    const oldTableId = order.tableId
    
    // Import Table model
    const Table = require("../model/Table")
    
    // Update old table status to "available" if it exists
    if (oldTableId) {
      try {
        const oldTable = await Table.findById(oldTableId)
        if (oldTable) {
          oldTable.status = "available"
          await oldTable.save()
        }
      } catch (error) {
      }
    }
    
    // Find and update new table status to "reserved"
    try {
      // Find the new table by table number, branch, and category
      const newTable = await Table.findOne({
        number: tableNumber,
        branchId: order.branchId,
        categoryId: order.categoryId
      })
      
      if (newTable) {
        newTable.status = "reserved"
        await newTable.save()
        
        // Update order with new table info
        order.tableNumber = tableNumber
        order.tableId = newTable._id
        
      } else {
        // If table not found in database, just update the table number
        order.tableNumber = tableNumber
      }
    } catch (error) {
      // Still update the order table number even if table status update fails
      order.tableNumber = tableNumber
    }
    
    // Save the order
    await order.save()
    
    
    res.status(200).json({
      success: true,
      message: `Table switched from ${oldTableNumber} to ${tableNumber}`,
      order: order
    })
    
  } catch (error) {
    console.error("❌ Error updating table number:", error)
    res.status(500).json({
      success: false,
      message: "Failed to update table number",
      error: error.message
    })
  }
}