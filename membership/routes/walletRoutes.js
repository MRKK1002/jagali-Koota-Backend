const express = require("express");
const router = express.Router();
const {
  getWalletBalance,
  getWalletTransactions,
  addMoneyToWallet,
  deductMoneyFromWallet,
  getAllWalletTransactions,
  adminWalletTransaction,
} = require("../controllers/walletController");
const { protectMember } = require("../middleware/memberAuth");
const Member = require("../models/Member");
const WalletTransaction = require("../models/WalletTransaction");
const mongoose = require("mongoose");

// Member routes (protected)
router.get("/balance", protectMember, getWalletBalance);
router.get("/transactions", protectMember, getWalletTransactions);

// Admin routes (add admin auth middleware later)
router.post("/add-money", addMoneyToWallet);
router.post("/deduct", deductMoneyFromWallet);
router.post("/admin-transaction", adminWalletTransaction);
router.get("/all-transactions", getAllWalletTransactions);

// ─── NEW: Deduct from wallet for counter bill (Member App orders) ───────────
// POST /api/v1/hotel/wallet/deduct-for-order
router.post("/deduct-for-order", async (req, res) => {
  try {
    const { orderId, memberPhone, amount } = req.body;

    // Validate inputs
    if (!orderId || !memberPhone || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId, memberPhone, amount",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    // Find member by phone
    const member = await Member.findOne({ phone: memberPhone });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // Check wallet balance
    const currentBalance = member.walletBalance || 0;
    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
        currentBalance: currentBalance,
        requiredAmount: amount,
      });
    }

    // Create wallet transaction (this also updates member balance)
    const transaction = await WalletTransaction.createTransaction({
      memberId: member._id,
      type: "debit",
      amount: amount,
      description: `Payment for order ${orderId}`,
      orderId: orderId,
      createdBy: "system",
      metadata: {
        source: "counter_bill",
        memberApp: true,
      },
    });

    // Update order payment status
    try {
      const CounterOrder =
        mongoose.connection.models.CounterOrder ||
        mongoose.connection.models.counterOrder ||
        mongoose.connection.models["counter-order"];

      if (CounterOrder) {
        await CounterOrder.findByIdAndUpdate(orderId, {
          paymentMethod: "wallet",
          paymentStatus: "paid",
          walletDeducted: true,
          walletDeductedAt: new Date(),
        });
      }
    } catch (orderError) {
      console.error("Error updating order:", orderError);
    }

    return res.status(200).json({
      success: true,
      message: "Amount deducted successfully",
      transaction: {
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        transactionDate: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error("Error deducting wallet amount:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to deduct amount from wallet",
    });
  }
});

// ─── NEW: Get member details by order ID (for BillGeneration page) ──────────
// GET /api/v1/hotel/wallet/member-by-order/:orderId
router.get("/member-by-order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    // Find the counter order model
    const CounterOrder =
      mongoose.connection.models.CounterOrder ||
      mongoose.connection.models.counterOrder ||
      mongoose.connection.models["counter-order"];

    if (!CounterOrder) {
      return res.status(500).json({
        success: false,
        message: "Order model not found",
      });
    }

    // Find order
    const order = await CounterOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if it's a member app order
    if (order.serverName !== "Member App") {
      return res.status(400).json({
        success: false,
        message: "This is not a Member App order",
        isMemberOrder: false,
      });
    }

    // Find member by userId or phone number
    let member;
    if (order.userId) {
      member = await Member.findById(order.userId);
    }

    if (!member && order.phoneNumber) {
      member = await Member.findOne({ phone: order.phoneNumber });
    }

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found for this order",
      });
    }

    return res.status(200).json({
      success: true,
      member: {
        id: member._id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        memberNumber: member.memberNumber,
        membershipType: member.membershipType,
        walletBalance: member.walletBalance || 0,
        profileImage: member.profileImage,
      },
    });
  } catch (error) {
    console.error("Error fetching member details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch member details",
      error: error.message,
    });
  }
});

module.exports = router;
