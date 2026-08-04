const express = require("express");
const router = express.Router();
const {
  placeOrder,
  getMyOrders,
  getAllOrders,
  completeOrder,
  updateOrderStatus,
  cancelOrder,
  addItems,
} = require("../controllers/memberOrderController");
const { protectMember } = require("../middleware/memberAuth");
const authMiddleware = require("../../middleware/authMiddleware"); 

// Member routes
router.post("/", protectMember, placeOrder);                     
router.get("/my-orders", protectMember, getMyOrders);            
router.put("/:id/cancel", protectMember, cancelOrder);          
router.put("/:id/add-items", protectMember, addItems);         

// Admin routes
router.get("/all", authMiddleware, getAllOrders); 
router.put("/:id/complete", authMiddleware, completeOrder); 
router.put("/:id/status", authMiddleware, updateOrderStatus); 

module.exports = router;
