const express = require("express");
const router = express.Router();
const {
  placeOrder,
  getMyOrders,
  getAllOrders,
  completeOrder,
  updateOrderStatus,
  cancelOrder,
} = require("../controllers/memberOrderController");
const { protectMember } = require("../middleware/memberAuth");
const authMiddleware = require("../../middleware/authMiddleware"); // Admin auth

// Member routes
router.post("/", protectMember, placeOrder); // Place order
router.get("/my-orders", protectMember, getMyOrders); // Get my orders
router.put("/:id/cancel", protectMember, cancelOrder); // Cancel order

// Admin routes
router.get("/all", authMiddleware, getAllOrders); // Get all orders
router.put("/:id/complete", authMiddleware, completeOrder); // Complete order & deduct wallet
router.put("/:id/status", authMiddleware, updateOrderStatus); // Update order status

module.exports = router;
