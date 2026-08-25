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
    const { orderId, orderIds, memberPhone, amount } = req.body;

    // Validate inputs
    if ((!orderId && (!orderIds || orderIds.length === 0)) || !memberPhone || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId/orderIds, memberPhone, amount",
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

    // Build the list of all order IDs to update
    const allOrderIds = orderIds && orderIds.length > 0
      ? [...new Set(orderIds)]
      : (orderId ? [orderId] : []);

    const primaryOrderId = allOrderIds[0];

    // Create wallet transaction (this also updates member balance)
    const transaction = await WalletTransaction.createTransaction({
      memberId: member._id,
      type: "debit",
      amount: amount,
      description: `Payment for order ${primaryOrderId}`,
      orderId: primaryOrderId,
      createdBy: "system",
      metadata: {
        source: "counter_bill",
        memberApp: true,
        allOrderIds: allOrderIds,
      },
    });

    // Update ALL order payment statuses
    try {
      const CounterOrder =
        mongoose.connection.models.CounterOrder ||
        mongoose.connection.models.counterOrder ||
        mongoose.connection.models["counter-order"];

      if (CounterOrder && allOrderIds.length > 0) {
        await CounterOrder.updateMany(
          { _id: { $in: allOrderIds } },
          {
            paymentMethod: "wallet",
            paymentStatus: "paid",
            walletDeducted: true,
            walletDeductedAt: new Date(),
          }
        );
      }
    } catch (orderError) {
      console.error("Error updating orders:", orderError);
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

    // "0000000000" is CartScreen.js's placeholder for a missing phone number,
    // never a real one — don't use it to look up a member, or an order with
    // no phone could match whichever member happens to have that placeholder
    // stored as their number.
    if (!member && order.phoneNumber && order.phoneNumber !== "0000000000") {
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

// ─── NEW: Complete order from Member App — deduct wallet, mark completed, free table ──
// POST /api/v1/hotel/wallet/complete-member-order
router.post("/complete-member-order", async (req, res) => {
  try {
    const { orderIds, tableId, memberPhone } = req.body;

    // Validate inputs
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: orderIds (array of KOT IDs)",
      });
    }
    if (!memberPhone) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: memberPhone",
      });
    }

    // Find member
    const member = await Member.findOne({ phone: memberPhone });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // Find the CounterOrder model
    const CounterOrder =
      mongoose.connection.models.CounterOrder ||
      mongoose.connection.models.counterOrder ||
      mongoose.connection.models["counter-order"];

    if (!CounterOrder) {
      return res.status(500).json({
        success: false,
        message: "Order model not available",
      });
    }

    // Fetch all orders and calculate total
    const orders = await CounterOrder.find({ _id: { $in: orderIds } });
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for given IDs",
      });
    }

    const totalAmount = orders.reduce((sum, order) => {
      return sum + (order.grandTotal || order.totalAmount || 0);
    }, 0);

    // Check wallet balance
    const currentBalance = member.walletBalance || 0;
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
        currentBalance: currentBalance,
        requiredAmount: totalAmount,
        shortBy: totalAmount - currentBalance,
      });
    }

    // Deduct from wallet
    const transaction = await WalletTransaction.createTransaction({
      memberId: member._id,
      type: "debit",
      amount: totalAmount,
      description: `Order payment - Table ${orders[0].tableNumber || "N/A"}`,
      orderId: orderIds[0],
      createdBy: "system",
      metadata: {
        source: "member_app_complete",
        allOrderIds: orderIds,
        tableNumber: orders[0].tableNumber,
      },
    });

    // Mark all KOTs as completed and paid
    await CounterOrder.updateMany(
      { _id: { $in: orderIds } },
      {
        paymentMethod: "wallet",
        paymentStatus: "paid",
        orderStatus: "completed",
        status: "completed",
        walletDeducted: true,
        walletDeductedAt: new Date(),
      }
    );

    // Free the table
    if (tableId) {
      try {
        const Table =
          mongoose.connection.models.Table ||
          mongoose.connection.model("Table");
        await Table.findByIdAndUpdate(tableId, { status: "available" });
      } catch (tableErr) {
        console.warn("Failed to free table:", tableErr.message);
        // Don't fail the whole request if table update fails
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order completed successfully",
      transaction: {
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
      },
      totalAmount: totalAmount,
      ordersCompleted: orders.length,
    });
  } catch (error) {
    console.error("Error completing member order:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to complete order",
    });
  }
});

module.exports = router;
