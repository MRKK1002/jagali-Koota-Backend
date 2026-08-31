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


router.get("/balance", protectMember, getWalletBalance);
router.get("/transactions", protectMember, getWalletTransactions);

router.post("/add-money", addMoneyToWallet);
router.post("/deduct", deductMoneyFromWallet);
router.post("/admin-transaction", adminWalletTransaction);
router.get("/all-transactions", getAllWalletTransactions);


router.post("/deduct-for-order", async (req, res) => {
  try {
    const { orderId, orderIds, memberPhone, amount } = req.body;


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


    const allOrderIds = orderIds && orderIds.length > 0
      ? [...new Set(orderIds)]
      : (orderId ? [orderId] : []);

    const primaryOrderId = allOrderIds[0];

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

    // 🔔 Push notification to member — counter deducted from wallet
    try {
      const { sendToDevice } = require("../../services/firebaseNotification");
      if (member.fcmToken) {
        sendToDevice(
          member.fcmToken,
          "Wallet Payment",
          `₹${amount.toFixed(2)} has been deducted from your wallet for your order.`,
          { type: "wallet_deducted", amount: String(amount) }
        ).catch(() => {});
      }
    } catch (fcmErr) { /* non-blocking */ }

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

    const subtotalBeforeDiscount = orders.reduce((sum, order) => {
      return sum + (order.grandTotal || order.totalAmount || 0);
    }, 0);

    // Apply member discount
    const effectiveDiscount = member.getEffectiveDiscount ? member.getEffectiveDiscount() : 0;
    const discountAmount = Math.round((subtotalBeforeDiscount * effectiveDiscount) / 100);
    const totalAmount = subtotalBeforeDiscount - discountAmount;

    // Check wallet balance
    const currentBalance = member.walletBalance || 0;
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
        currentBalance: currentBalance,
        requiredAmount: totalAmount,
        shortBy: totalAmount - currentBalance,
        discount: { percentage: effectiveDiscount, amount: discountAmount },
      });
    }

    // Deduct from wallet
    const transaction = await WalletTransaction.createTransaction({
      memberId: member._id,
      type: "debit",
      amount: totalAmount,
      description: `Order payment - Table ${orders[0].tableNumber || "N/A"}${effectiveDiscount > 0 ? ` (${effectiveDiscount}% member discount applied)` : ''}`,
      orderId: orderIds[0],
      createdBy: "system",
      metadata: {
        source: "member_app_complete",
        allOrderIds: orderIds,
        tableNumber: orders[0].tableNumber,
        subtotalBeforeDiscount,
        discountPercentage: effectiveDiscount,
        discountAmount,
      },
    });

    // Mark all KOTs as completed and paid.
    // Values match the Counter flow (counterOrderController): orderStatus and
    // paymentStatus both use "completed" — the only valid enum values on the
    // CounterOrder schema. "paid"/"status"/"walletDeducted" are NOT on the
    // schema/enum and were being silently dropped or written as garbage.
    await CounterOrder.updateMany(
      { _id: { $in: orderIds } },
      {
        paymentMethod: "wallet",
        paymentStatus: "completed",
        orderStatus: "completed",
      }
    );

    // Generate an invoice number and create a consolidated bill entry so the
    // counter's Sales Report recognises this as a settled bill.
    try {
      const BillNumberService = require("../../services/billNumberService");
      const branchId = orders[0].branch || orders[0].branchId;
      const categoryName = orders[0].categoryName || "Restaurant";
      const invoiceNumber = await BillNumberService.getNextBillNumber(
        branchId,
        categoryName
      );

      // Create a consolidated bill record (no kotNumber = real bill)
      const allItems = orders.reduce((acc, o) => [...acc, ...(o.items || [])], []);
      await CounterOrder.create({
        branch: branchId,
        userId: orders[0].userId,
        customerName: orders[0].customerName || "Member",
        phoneNumber: orders[0].phoneNumber,
        tableNumber: orders[0].tableNumber,
        tableId: tableId || orders[0].tableId,
        serverName: "Member App",
        items: allItems,
        subtotal: totalAmount,
        totalAmount: totalAmount,
        grandTotal: totalAmount,
        gstAmount: 0,
        paymentMethod: "wallet",
        paymentStatus: "completed",
        orderStatus: "completed",
        invoiceNumber: invoiceNumber,
        categoryName: categoryName,
        branchName: orders[0].branchName || "Restaurant",
        source: "member-app",
        notes: "Completed via Member App wallet payment",
      });

      // Mark the original KOTs as consolidated (so they don't show as separate entries)
      await CounterOrder.updateMany(
        { _id: { $in: orderIds } },
        { paymentStatus: "consolidated", orderStatus: "completed" }
      );
    } catch (billErr) {
      console.warn("Failed to create consolidated bill (order still marked completed):", billErr.message);
      // Non-blocking — the order is already completed/paid even if bill creation fails
    }

    // Invalidate the counter order GET cache so fresh data is returned immediately
    try {
      const { invalidateOrderCache } = require("../../controller/counterOrderController");
      if (typeof invalidateOrderCache === "function") invalidateOrderCache();
    } catch (_) {}

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

    // 🔔 Push notification to member — wallet deducted, order completed
    try {
      const { sendToMember } = require("../../services/firebaseNotification");
      sendToMember(
        member._id,
        "Payment Successful!",
        `₹${totalAmount.toFixed(2)} deducted from wallet. Table ${orders[0].tableNumber || ""} order completed.`,
        { type: "wallet_deducted", amount: String(totalAmount), tableNumber: orders[0].tableNumber || "" }
      ).catch(() => {});
    } catch (fcmErr) { /* non-blocking */ }

    // 📧 Email receipt + low balance alert
    try {
      if (member.email) {
        const { sendReceiptEmail, sendLowBalanceEmail } = require("../../services/emailService");
        const allItems = orders.reduce((acc, o) => [...acc, ...(o.items || [])], []);
        sendReceiptEmail(member.email, {
          name: member.name,
          tableNumber: orders[0].tableNumber,
          items: allItems,
          subtotal: subtotalBeforeDiscount,
          discountPercent: effectiveDiscount,
          discountAmount,
          total: totalAmount,
          balanceAfter: transaction.balanceAfter,
        }).catch((e) => console.warn("[Receipt Email] Failed:", e.message));

        // Low balance alert (threshold ₹500)
        const LOW_BALANCE_THRESHOLD = 500;
        if (transaction.balanceAfter < LOW_BALANCE_THRESHOLD) {
          sendLowBalanceEmail(member.email, member.name, transaction.balanceAfter, LOW_BALANCE_THRESHOLD).catch(() => {});
        }
      }
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: "Order completed successfully",
      transaction: {
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
      },
      totalAmount: totalAmount,
      subtotalBeforeDiscount,
      discount: {
        percentage: effectiveDiscount,
        amount: discountAmount,
      },
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

// ─── ADMIN: Manually trigger monthly service charge (for testing) ────────────
// POST /api/v1/hotel/wallet/run-service-charge
router.post("/run-service-charge", async (req, res) => {
  try {
    const members = await Member.find({
      isActive: true,
      monthlyServiceCharge: { $gt: 0 },
    }).select("_id name phone walletBalance monthlyServiceCharge fcmToken");

    let results = [];
    for (const member of members) {
      const charge = member.monthlyServiceCharge;
      if ((member.walletBalance || 0) < charge) {
        results.push({ name: member.name, status: "failed", reason: "Insufficient balance" });
        continue;
      }

      const transaction = await WalletTransaction.createTransaction({
        memberId: member._id,
        type: "debit",
        amount: charge,
        description: `Monthly service charge — ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`,
        createdBy: "system",
        metadata: { source: "monthly_service_charge_manual" },
      });

      // Notification
      if (member.fcmToken) {
        const { sendToDevice } = require("../../services/firebaseNotification");
        sendToDevice(
          member.fcmToken,
          "Monthly Service Charge",
          `₹${charge.toFixed(2)} deducted as monthly service charge. Balance: ₹${transaction.balanceAfter.toFixed(2)}`,
          { type: "service_charge_deducted", amount: String(charge) }
        ).catch(() => {});
      }

      results.push({ name: member.name, status: "success", charged: charge, newBalance: transaction.balanceAfter });
    }

    res.json({ success: true, message: "Service charge processed", results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
