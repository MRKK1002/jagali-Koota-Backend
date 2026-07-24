const asyncHandler = require("express-async-handler");
const MemberOrder = require("../models/MemberOrder");
const Member = require("../models/Member");

// @desc    Place a new order
// @route   POST /api/membership/orders
// @access  Private (Member)
const placeOrder = asyncHandler(async (req, res) => {
  const { items, totalAmount, notes } = req.body;
  const memberId = req.member._id;

  // Validate member exists
  const member = await Member.findById(memberId);
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Create order
  const order = await MemberOrder.create({
    memberId,
    items,
    totalAmount,
    notes,
    status: "pending",
  });

  res.status(201).json({
    success: true,
    data: order,
  });
});

// @desc    Get member's orders
// @route   GET /api/membership/orders/my-orders
// @access  Private (Member)
const getMyOrders = asyncHandler(async (req, res) => {
  const memberId = req.member._id;

  const orders = await MemberOrder.find({ memberId })
    .sort({ createdAt: -1 })
    .populate("memberId", "name email phone memberNumber");

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

// @desc    Get all orders (Admin)
// @route   GET /api/membership/orders/all
// @access  Private (Admin)
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await MemberOrder.find()
    .sort({ createdAt: -1 })
    .populate("memberId", "name email phone memberNumber");

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

// @desc    Complete order and deduct from wallet
// @route   PUT /api/membership/orders/:id/complete
// @access  Private (Admin)
const completeOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await MemberOrder.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Get member and check wallet balance
  const member = await Member.findById(order.memberId);
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  if (member.walletBalance < order.totalAmount) {
    res.status(400);
    throw new Error("Insufficient wallet balance");
  }

  // Deduct from wallet and mark order as completed
  member.walletBalance -= order.totalAmount;
  await member.save();

  order.status = "completed";
  order.completedAt = new Date();
  await order.save();

  res.status(200).json({
    success: true,
    data: order,
    message: "Order completed and amount deducted from wallet",
  });
});

// @desc    Update order status
// @route   PUT /api/membership/orders/:id/status
// @access  Private (Admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["pending", "processing", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error("Invalid status value");
  }

  const order = await MemberOrder.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.status = status;
  if (status === "completed") {
    order.completedAt = new Date();
  }
  await order.save();

  res.status(200).json({
    success: true,
    data: order,
  });
});

// @desc    Cancel order
// @route   PUT /api/membership/orders/:id/cancel
// @access  Private (Member)
const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const memberId = req.member._id;

  const order = await MemberOrder.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if order belongs to member
  if (order.memberId.toString() !== memberId.toString()) {
    res.status(403);
    throw new Error("Not authorized to cancel this order");
  }

  // Only allow cancellation of pending orders
  if (order.status !== "pending") {
    res.status(400);
    throw new Error("Only pending orders can be cancelled");
  }

  order.status = "cancelled";
  await order.save();

  res.status(200).json({
    success: true,
    data: order,
    message: "Order cancelled successfully",
  });
});

module.exports = {
  placeOrder,
  getMyOrders,
  getAllOrders,
  completeOrder,
  updateOrderStatus,
  cancelOrder,
};
