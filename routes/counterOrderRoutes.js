const express = require("express")
const router = express.Router()
const counterOrderController = require("../controller/counterOrderController")
const { validateStock, updateStockAfterOrder, restoreStockOnCancellation } = require("../middleware/stockMiddleware")

// List all orders - this should come BEFORE the /:id route
router.get("/orders", counterOrderController.getAllCounterOrders)

// Get categorized orders with pagination and filtering (optimized for big data)
router.get("/categorized-orders", counterOrderController.getCategorizedOrders)

// Get orders by user ID
router.get("/orders/user/:userId", counterOrderController.getCounterOrdersByUserId)

// Create a new order (with stock validation)
router.post("/orders", validateStock, counterOrderController.createCounterOrder, updateStockAfterOrder)

// Create a new order without stock validation (for counter app)
router.post("/orders-no-stock", counterOrderController.createCounterOrder)

// Get order by ID
router.get("/orders/:id", counterOrderController.getCounterOrderById)

// Update entire order
router.put("/orders/:id", counterOrderController.updateCounterOrder)
    
// Update order status only
router.put("/orders/:id/order-status", counterOrderController.updateCounterOrderStatus)

// Update payment status only
router.put("/orders/:id/payment-status", counterOrderController.updateCounterPaymentStatus)

// Cancel order with reason
router.put("/orders/:id/cancel", counterOrderController.cancelCounterOrder)

// Clear all orders (for testing/cleanup)
router.delete("/orders/clear-all", counterOrderController.clearAllCounterOrders)

module.exports = router