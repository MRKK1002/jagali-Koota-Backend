const express = require("express")
const router = express.Router()
const orderController = require("../controller/orderController")
const { validateStock, updateStockAfterOrder, restoreStockOnCancellation } = require("../middleware/stockMiddleware")

// Order routes
router.post("/", validateStock, orderController.createOrder, updateStockAfterOrder)
router.get("/user/:userId", orderController.getUserOrders)
router.get("/branch/:branchId", orderController.getBranchOrders)
router.get("/stats", orderController.getOrderStats)
router.get("/number/:orderNumber", orderController.getOrderByNumber)
router.get("/:id", orderController.getOrderById)
router.put("/:id/status", restoreStockOnCancellation, orderController.updateOrderStatus)
router.put("/:id/payment-status", orderController.updatePaymentStatus) // New route for payment status
router.delete("/:id", orderController.deleteOrder) // Delete single order
router.delete("/bulk/clear", orderController.bulkDeleteOrders) // Bulk delete orders
router.get("/", orderController.getAllOrders)
module.exports = router