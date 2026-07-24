const express = require("express")
const router = express.Router()
const staffOrderController = require("../controller/staffOrderController")
const { validateStock, updateStockAfterOrder, restoreStockOnCancellation } = require("../middleware/stockMiddleware")

// Create staff order after payment success (EXISTING)
router.post("/create-after-payment", validateStock, staffOrderController.createStaffOrderAfterPayment, updateStockAfterOrder)

// NEW: Create guest order (with stock validation)
router.post("/create-guest-order", validateStock, staffOrderController.createGuestOrder, updateStockAfterOrder)

// NEW: Create guest order without stock validation (for menu items without stock tracking)
router.post("/create-guest-order-no-stock", staffOrderController.createGuestOrder)

// Get orders by userId - EXISTING (must be before /:id route)
router.get("/user/:userId", staffOrderController.getOrdersByUserId)

// Get available status values - NEW
router.get("/available-statuses", staffOrderController.getAvailableStatuses)

// Get all orders (both staff and guest) - EXISTING
router.get("/", staffOrderController.getAllStaffOrders)

// Get order statistics - EXISTING
router.get("/statistics", staffOrderController.getOrderStatistics)

// Get orders by payment status - EXISTING
router.get("/payment-status/:paymentStatus", staffOrderController.getOrdersByPaymentStatus)

// Get orders by branch - EXISTING
router.get("/branch/:branchId", staffOrderController.getOrdersByBranch)

// NEW: Get guest orders by mobile number
router.get("/guest/mobile/:mobile", staffOrderController.getGuestOrdersByMobile)

// Get order by orderId - EXISTING (MUST BE BEFORE /:id route)
router.get("/order/:orderId", staffOrderController.getStaffOrderByOrderId)

// Get order by ID - EXISTING
router.get("/:id", staffOrderController.getStaffOrderById)

// Update order status - EXISTING (works for both staff and guest orders)
router.put("/:id/status", staffOrderController.updateStaffOrderStatus)

// Update table number - NEW
router.put("/:id/table", staffOrderController.updateOrderTableNumber)

// Delete order - EXISTING (works for both staff and guest orders)
router.delete("/:id", staffOrderController.deleteStaffOrder)

// Bulk delete orders - NEW (for clearing old data)
router.delete("/bulk/clear-all", staffOrderController.bulkDeleteStaffOrders)

// Add items to existing order - EXISTING
router.post("/:id/items", staffOrderController.addItemsToStaffOrder)

// Get orders by branch and table - EXISTING
router.get("/branch/:branchId/table/:tableId", staffOrderController.getStaffOrdersByTable)

module.exports = router

// Mark order as complimentary
router.put("/:id/complimentary", staffOrderController.markOrderAsComplimentary)

// Cancel order
router.put("/:id/cancel", staffOrderController.cancelOrder)

// Apply discount
router.put("/:id/discount", staffOrderController.applyDiscount)