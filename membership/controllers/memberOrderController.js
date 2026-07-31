const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const MemberOrder = require("../models/MemberOrder");
const Member = require("../models/Member");
const StaffOrder = require("../../model/staffOrderModel");
const KotCounter = require("../../model/kotCounterModel");
const Branch = require("../../model/Branch");
const Table = require("../../model/Table");

// ─────────────────────────────────────────────────────────────
// Helper: create a KOT (StaffOrder) for a member order
// ─────────────────────────────────────────────────────────────
const createKOTForMemberOrder = async (memberOrder, member) => {
  try {
    // Resolve branch
    let branchId = memberOrder.branchId;
    let branchName = memberOrder.branchName || "Jagali Koota";

    if (!branchId) {
      const branch = await Branch.findOne({});
      if (branch) { branchId = branch._id; branchName = branch.name; }
    } else {
      const branch = await Branch.findById(branchId);
      if (branch) branchName = branch.name;
    }

    if (!branchId) {
      console.error("❌ No branch found for KOT creation");
      return null;
    }

    // Reserve the table if provided
    const tableNumber = memberOrder.tableNumber || "Member App";
    if (memberOrder.tableId) {
      await Table.findByIdAndUpdate(
        memberOrder.tableId,
        { status: "reserved" },
        { new: true }
      ).catch(e => console.warn("⚠️ Table reserve failed:", e.message));
    }

    // Generate KOT number
    const kotNumber = await KotCounter.getNextKotNumber(branchId);

    // Map items for StaffOrder schema
    const orderItems = memberOrder.items.map((item) => ({
      menuItemId: item.itemId
        ? item.itemId.toString()
        : new mongoose.Types.ObjectId().toString(),
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      kotNumber,
      isNewItem: true,
    }));

    const subtotal = memberOrder.totalAmount;
    const tax = subtotal * 0.05;
    const serviceCharge = subtotal * 0.1;
    const grandTotal = subtotal + tax + serviceCharge;

    const kot = new StaffOrder({
      orderId: `MBR-${Date.now()}`,
      branchId,
      branchName,
      customerName: member.name,
      customerMobile: member.phone || "0000000000",
      tableId: memberOrder.tableId || null,
      tableNumber,
      peopleCount: 1,
      items: orderItems,
      subtotal,
      tax,
      serviceCharge,
      totalAmount: subtotal,
      grandTotal,
      paymentMethod: "wallet",
      paymentStatus: "pending",
      status: "pending",
      orderTime: new Date(),
      notes: `Member Order: ${memberOrder.orderNumber} | Member No: ${member.memberNumber}`,
      isGuestOrder: true,
      kotNumber,
      kotCounter: 1,
      kots: [{
        kotNumber,
        items: memberOrder.items.map((i) => i.name),
        generatedAt: new Date(),
        itemCount: memberOrder.items.reduce((s, i) => s + i.quantity, 0),
      }],
    });

    await kot.save();

    // Update MemberOrder with KOT reference
    await MemberOrder.findByIdAndUpdate(memberOrder._id, {
      kotNumber,
      branchId,
      branchName,
    });

    console.log(`✅ KOT ${kotNumber} created for member order ${memberOrder.orderNumber}, table ${tableNumber}`);
    return kot;
  } catch (err) {
    console.error("⚠️ KOT creation failed (non-blocking):", err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// @desc    Place a new order
// @route   POST /api/v1/hotel/member-orders
// @access  Private (Member)
// ─────────────────────────────────────────────────────────────
const placeOrder = asyncHandler(async (req, res) => {
  const { items, notes, branchId, tableId, tableNumber } = req.body;
  let { totalAmount } = req.body;
  const memberId = req.member._id;

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error("Please provide items to order");
  }

  // Calculate totalAmount from items if not provided
  if (!totalAmount || totalAmount === 0) {
    totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }

  const member = await Member.findById(memberId);
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Check wallet balance upfront
  if (member.walletBalance < totalAmount) {
    res.status(400);
    throw new Error(
      `Insufficient wallet balance. You have ₹${member.walletBalance.toFixed(2)}, order total is ₹${totalAmount.toFixed(2)}`
    );
  }

  // Format items
  const formattedItems = items.map((item) => ({
    itemId: item._id || item.itemId || item.menuItemId || null,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
  }));

  const order = await MemberOrder.create({
    memberId,
    memberName: member.name,
    memberPhone: member.phone || "",
    branchId: branchId || null,
    tableId: tableId || null,
    tableNumber: tableNumber || null,
    items: formattedItems,
    totalAmount,
    notes: notes || "",
    status: "pending",
  });

  // Auto-create KOT — non-blocking
  createKOTForMemberOrder(order, member);

  res.status(201).json({
    success: true,
    message: `Order placed for Table ${tableNumber || "N/A"}! Your order is being prepared.`,
    data: order,
  });
});

// ─────────────────────────────────────────────────────────────
// @desc    Get member's own orders
// @route   GET /api/v1/hotel/member-orders/my-orders
// @access  Private (Member)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// @desc    Get all orders (Admin)
// @route   GET /api/v1/hotel/member-orders/all
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// @desc    Complete order — deduct wallet + free table
// @route   PUT /api/v1/hotel/member-orders/:id/complete
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────
const completeOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await MemberOrder.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.status === "completed") {
    res.status(400);
    throw new Error("Order is already completed");
  }

  const member = await Member.findById(order.memberId);
  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  if (member.walletBalance < order.totalAmount) {
    res.status(400);
    throw new Error(
      `Insufficient wallet balance. Current: ₹${member.walletBalance.toFixed(2)}, Required: ₹${order.totalAmount.toFixed(2)}`
    );
  }

  // Deduct wallet
  member.walletBalance -= order.totalAmount;
  await member.save();

  // Update order
  order.status = "completed";
  order.completedAt = new Date();
  await order.save();

  // Free the table
  if (order.tableId) {
    await Table.findByIdAndUpdate(
      order.tableId,
      { status: "available" },
      { new: true }
    ).catch(e => console.warn("⚠️ Table free failed:", e.message));
  }

  // Sync linked KOT
  if (order.kotNumber) {
    await StaffOrder.findOneAndUpdate(
      { kotNumber: order.kotNumber },
      { status: "completed", paymentStatus: "completed" }
    ).catch((e) => console.error("⚠️ KOT sync failed:", e.message));
  }

  res.status(200).json({
    success: true,
    message: `Order completed! ₹${order.totalAmount.toFixed(2)} deducted from wallet.`,
    data: order,
    remainingBalance: member.walletBalance,
  });
});

// ─────────────────────────────────────────────────────────────
// @desc    Update order status
// @route   PUT /api/v1/hotel/member-orders/:id/status
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────
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
  if (status === "completed") order.completedAt = new Date();
  if (status === "cancelled") order.cancelledAt = new Date();
  await order.save();

  // Sync KOT
  if (order.kotNumber) {
    const kotStatus = status === "completed" ? "completed"
      : status === "cancelled" ? "cancelled"
      : status === "processing" ? "preparing"
      : "pending";
    await StaffOrder.findOneAndUpdate(
      { kotNumber: order.kotNumber },
      { status: kotStatus }
    ).catch(() => {});
  }

  res.status(200).json({ success: true, data: order });
});

// ─────────────────────────────────────────────────────────────
// @desc    Cancel order (Member)
// @route   PUT /api/v1/hotel/member-orders/:id/cancel
// @access  Private (Member)
// ─────────────────────────────────────────────────────────────
const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const memberId = req.member._id;

  const order = await MemberOrder.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.memberId.toString() !== memberId.toString()) {
    res.status(403);
    throw new Error("Not authorized to cancel this order");
  }

  if (order.status !== "pending") {
    res.status(400);
    throw new Error("Only pending orders can be cancelled");
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();
  await order.save();

  // Free the table
  if (order.tableId) {
    await Table.findByIdAndUpdate(
      order.tableId,
      { status: "available" }
    ).catch(() => {});
  }

  // Cancel linked KOT
  if (order.kotNumber) {
    await StaffOrder.findOneAndUpdate(
      { kotNumber: order.kotNumber },
      { status: "cancelled" }
    ).catch(() => {});
  }

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
