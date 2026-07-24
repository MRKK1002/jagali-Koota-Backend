const StaffInvoice = require("../model/StaffInvoiceModel")
const StaffOrder = require("../model/staffOrderModel")
const StaffLogin = require("../model/staffLoginModel")
const mongoose = require("mongoose")

// Generate a unique invoice ID
const generateInvoiceId = () => {
  const timestamp = new Date().getTime()
  const randomNum = Math.floor(Math.random() * 1000)
  return `INV-${timestamp}-${randomNum}`
}

// Create a new invoice from an order
exports.createInvoiceFromOrder = async (req, res) => {
  try {
    const { orderId } = req.body

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      })
    }


    // Check if invoice already exists for this order
    const existingInvoice = await StaffInvoice.findOne({ orderId })
    if (existingInvoice) {
      return res.status(200).json({
        success: true,
        message: "Invoice already exists for this order",
        invoice: existingInvoice,
      })
    }

    // Find the order
    const order = await StaffOrder.findOne({ orderId }).populate("userId", "name mobile")
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }


    // Create invoice data from order
    const invoiceData = {
      userId: order.userId ? order.userId._id : null, // Handle guest orders (userId can be null)
      invoiceId: generateInvoiceId(),
      orderId: order.orderId,
      branchId: order.branchId,
      branchName: order.branchName,
      tableId: order.tableId,
      tableNumber: order.tableNumber,
      peopleCount: order.peopleCount,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      serviceCharge: order.serviceCharge,
      totalAmount: order.totalAmount,
      grandTotal: order.grandTotal,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      invoiceDate: new Date(),
      notes: order.notes || "",
    }

    // Create the invoice
    const invoice = new StaffInvoice(invoiceData)
    await invoice.save()


    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      invoice,
    })
  } catch (error) {
    console.error("Error creating invoice:", error)
    res.status(500).json({
      success: false,
      message: "Error creating invoice",
      error: error.message,
    })
  }
}

// Get invoices by userId
exports.getInvoicesByUserId = async (req, res) => {
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

    const invoices = await StaffInvoice.find({ userId })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")
      .sort({ invoiceDate: -1 })

    res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
      user: {
        name: user.name,
        mobile: user.mobile,
      },
    })
  } catch (error) {
    console.error("Error fetching user invoices:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message,
    })
  }
}

// Get all invoices with optional filtering
exports.getAllInvoices = async (req, res) => {
  try {
    const { branchId, tableId, startDate, endDate, paymentStatus, paymentMethod, userId } = req.query

    // Build filter based on query parameters
    const filter = {}
    if (branchId) filter.branchId = branchId
    if (tableId) filter.tableId = tableId
    if (paymentStatus) filter.paymentStatus = paymentStatus
    if (paymentMethod) filter.paymentMethod = paymentMethod
    if (userId) filter.userId = userId

    // Date range filter
    if (startDate || endDate) {
      filter.invoiceDate = {}
      if (startDate) filter.invoiceDate.$gte = new Date(startDate)
      if (endDate) filter.invoiceDate.$lte = new Date(endDate)
    }

    const invoices = await StaffInvoice.find(filter)
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")
      .sort({ invoiceDate: -1 })

    res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    })
  } catch (error) {
    console.error("Error fetching invoices:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message,
    })
  }
}

// Get invoice by ID
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await StaffInvoice.findById(req.params.id)
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      })
    }

    res.status(200).json({
      success: true,
      invoice,
    })
  } catch (error) {
    console.error("Error fetching invoice:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching invoice",
      error: error.message,
    })
  }
}

// Get invoice by invoice ID
exports.getInvoiceByInvoiceId = async (req, res) => {
  try {
    const { invoiceId } = req.params

    const invoice = await StaffInvoice.findOne({ invoiceId })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      })
    }


    res.status(200).json({
      success: true,
      invoice,
    })
  } catch (error) {
    console.error("Error fetching invoice by invoiceId:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching invoice",
      error: error.message,
    })
  }
}

// Get invoices by order ID
exports.getInvoicesByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params

    const invoices = await StaffInvoice.find({ orderId })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")
      .sort({ invoiceDate: -1 })


    res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    })
  } catch (error) {
    console.error("Error fetching invoices by orderId:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching invoices",
      error: error.message,
    })
  }
}

// Update invoice
exports.updateInvoice = async (req, res) => {
  try {
    const { notes, paymentStatus } = req.body

    const updateData = {}
    if (notes !== undefined) updateData.notes = notes
    if (paymentStatus) updateData.paymentStatus = paymentStatus

    const invoice = await StaffInvoice.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("branchId", "name address")
      .populate("tableId", "number capacity")
      .populate("userId", "name mobile")

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      invoice,
    })
  } catch (error) {
    console.error("Error updating invoice:", error)
    res.status(400).json({
      success: false,
      message: "Error updating invoice",
      error: error.message,
    })
  }
}

// Delete invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await StaffInvoice.findById(req.params.id)

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      })
    }

    await StaffInvoice.findByIdAndDelete(req.params.id)

    res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting invoice:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting invoice",
      error: error.message,
    })
  }
}

// Get invoice statistics
exports.getInvoiceStatistics = async (req, res) => {
  try {
    const { branchId, startDate, endDate, userId } = req.query

    const matchFilter = {}
    if (branchId) matchFilter.branchId = new mongoose.Types.ObjectId(branchId)
    if (userId) matchFilter.userId = new mongoose.Types.ObjectId(userId)

    // Date range filter
    if (startDate || endDate) {
      matchFilter.invoiceDate = {}
      if (startDate) matchFilter.invoiceDate.$gte = new Date(startDate)
      if (endDate) matchFilter.invoiceDate.$lte = new Date(endDate)
    }

    const stats = await StaffInvoice.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: "$grandTotal" },
          averageInvoiceValue: { $avg: "$grandTotal" },
        },
      },
    ])

    const paymentMethodStats = await StaffInvoice.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ])

    const branchStats = await StaffInvoice.aggregate([
      { $match: userId ? { userId: new mongoose.Types.ObjectId(userId) } : {} },
      {
        $group: {
          _id: "$branchId",
          branchName: { $first: "$branchName" },
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: "$grandTotal" },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ])

    res.status(200).json({
      success: true,
      statistics: stats[0] || {},
      paymentMethodStats,
      branchStats,
    })
  } catch (error) {
    console.error("Error fetching invoice statistics:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching invoice statistics",
      error: error.message,
    })
  }
}

// Get daily revenue report
exports.getDailyRevenueReport = async (req, res) => {
  try {
    const { branchId, startDate, endDate, userId } = req.query

    const matchFilter = {}
    if (branchId) matchFilter.branchId = new mongoose.Types.ObjectId(branchId)
    if (userId) matchFilter.userId = new mongoose.Types.ObjectId(userId)

    // Date range filter (default to last 30 days if not specified)
    const endDateTime = endDate ? new Date(endDate) : new Date()
    const startDateTime = startDate ? new Date(startDate) : new Date(endDateTime.getTime() - 30 * 24 * 60 * 60 * 1000)

    matchFilter.invoiceDate = {
      $gte: startDateTime,
      $lte: endDateTime,
    }

    const dailyRevenue = await StaffInvoice.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
            day: { $dayOfMonth: "$invoiceDate" },
          },
          date: { $first: "$invoiceDate" },
          totalRevenue: { $sum: "$grandTotal" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
          totalRevenue: 1,
          invoiceCount: 1,
        },
      },
    ])

    res.status(200).json({
      success: true,
      dailyRevenue,
      dateRange: {
        startDate: startDateTime,
        endDate: endDateTime,
      },
    })
  } catch (error) {
    console.error("Error generating daily revenue report:", error)
    res.status(500).json({
      success: false,
      message: "Error generating daily revenue report",
      error: error.message,
    })
  }
}