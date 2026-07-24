const express = require("express")
const router = express.Router()
const mobileStaffOrderController = require("../controller/mobileStaffOrderController")

// Mobile app specific route - creates order and updates table status to reserved
router.post("/create-guest-order", mobileStaffOrderController.createMobileGuestOrder)

// Mobile app specific route - updates existing order with additional items
router.put("/:id/add-items", mobileStaffOrderController.updateMobileGuestOrderItems)

// Sales report - get completed bills for a category
router.get("/sales-report", mobileStaffOrderController.getCategorySalesReport)

// Get category orders (with default today filter)
router.get("/orders", mobileStaffOrderController.getCategoryOrders)

// Get cancelled orders (with default today filter)
router.get("/cancelled", mobileStaffOrderController.getCategoryCancelledOrders)

// Get complimentary orders (with default today filter)
router.get("/complimentary", mobileStaffOrderController.getCategoryComplimentaryOrders)

// Complete order and mark bill as printed
router.put("/:id/complete-and-print", mobileStaffOrderController.completeOrderAndPrintBill)

// Mark order as complimentary
router.put("/:id/complimentary", mobileStaffOrderController.markOrderAsComplimentary)

// Cancel order
router.put("/:id/cancel", mobileStaffOrderController.cancelOrder)

// Apply discount
router.put("/:id/discount", mobileStaffOrderController.applyDiscount)

module.exports = router