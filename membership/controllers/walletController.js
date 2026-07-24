const asyncHandler = require("express-async-handler");
const Member = require("../models/Member");
const WalletTransaction = require("../models/WalletTransaction");

// @desc    Get wallet balance
// @route   GET /api/v1/hotel/wallet/balance
// @access  Private
const getWalletBalance = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.member.id);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  res.json({
    success: true,
    walletBalance: member.walletBalance,
    memberNumber: member.memberNumber,
    name: member.name,
  });
});

// @desc    Get wallet transactions
// @route   GET /api/v1/hotel/wallet/transactions
// @access  Private
const getWalletTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;

  const query = { memberId: req.member.id };

  if (type && ["credit", "debit"].includes(type)) {
    query.type = type;
  }

  const transactions = await WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate("orderId", "orderNumber totalAmount")
    .populate("billId", "billNumber totalAmount");

  const count = await WalletTransaction.countDocuments(query);

  res.json({
    success: true,
    transactions,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    total: count,
  });
});

// @desc    Add money to wallet (Admin only)
// @route   POST /api/v1/hotel/wallet/add-money
// @access  Private/Admin
const addMoneyToWallet = asyncHandler(async (req, res) => {
  const { memberId, amount, description } = req.body;

  if (!memberId || !amount) {
    res.status(400);
    throw new Error("Please provide memberId and amount");
  }

  if (amount <= 0) {
    res.status(400);
    throw new Error("Amount must be greater than 0");
  }

  const member = await Member.findById(memberId);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Create transaction
  const transaction = await WalletTransaction.createTransaction({
    memberId,
    type: "credit",
    amount,
    description: description || `Money added by admin`,
    createdBy: "admin",
    adminId: req.admin?.id || null,
  });

  // Get updated member
  const updatedMember = await Member.findById(memberId);

  res.json({
    success: true,
    message: "Money added successfully",
    transaction,
    newBalance: updatedMember.walletBalance,
  });
});

// @desc    Deduct money from wallet (Internal use - billing)
// @route   POST /api/v1/hotel/wallet/deduct
// @access  Private/Admin
const deductMoneyFromWallet = asyncHandler(async (req, res) => {
  const { memberId, amount, description, orderId, billId } = req.body;

  if (!memberId || !amount) {
    res.status(400);
    throw new Error("Please provide memberId and amount");
  }

  if (amount <= 0) {
    res.status(400);
    throw new Error("Amount must be greater than 0");
  }

  const member = await Member.findById(memberId);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  if (member.walletBalance < amount) {
    res.status(400);
    throw new Error(
      `Insufficient wallet balance. Available: ₹${member.walletBalance}, Required: ₹${amount}`
    );
  }

  // Create transaction
  const transaction = await WalletTransaction.createTransaction({
    memberId,
    type: "debit",
    amount,
    description: description || `Payment for order`,
    orderId,
    billId,
    createdBy: "system",
  });

  // Get updated member
  const updatedMember = await Member.findById(memberId);

  res.json({
    success: true,
    message: "Money deducted successfully",
    transaction,
    newBalance: updatedMember.walletBalance,
  });
});

// @desc    Get all wallet transactions (Admin only)
// @route   GET /api/v1/hotel/wallet/all-transactions
// @access  Private/Admin
const getAllWalletTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, memberId, type } = req.query;

  const query = {};

  if (memberId) {
    query.memberId = memberId;
  }

  if (type && ["credit", "debit"].includes(type)) {
    query.type = type;
  }

  const transactions = await WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate("memberId", "memberNumber name email")
    .populate("orderId", "orderNumber totalAmount")
    .populate("billId", "billNumber totalAmount");

  const count = await WalletTransaction.countDocuments(query);

  res.json({
    success: true,
    transactions,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    total: count,
  });
});

// @desc    Admin wallet transaction (Add or deduct money)
// @route   POST /api/v1/hotel/wallet/admin-transaction
// @access  Private/Admin
const adminWalletTransaction = asyncHandler(async (req, res) => {
  const { memberId, amount, type, description } = req.body;

  if (!memberId || !amount || !type) {
    res.status(400);
    throw new Error("Please provide memberId, amount, and type (credit/debit)");
  }

  if (!["credit", "debit"].includes(type)) {
    res.status(400);
    throw new Error("Type must be 'credit' or 'debit'");
  }

  if (amount <= 0) {
    res.status(400);
    throw new Error("Amount must be greater than 0");
  }

  const member = await Member.findById(memberId);

  if (!member) {
    res.status(404);
    throw new Error("Member not found");
  }

  // Check balance for debit
  if (type === "debit" && member.walletBalance < amount) {
    res.status(400);
    throw new Error(
      `Insufficient wallet balance. Available: ₹${member.walletBalance}, Required: ₹${amount}`
    );
  }

  // Create transaction
  const transaction = await WalletTransaction.createTransaction({
    memberId,
    type,
    amount,
    description: description || `Admin ${type === 'credit' ? 'top-up' : 'deduction'}`,
    createdBy: "admin",
    adminId: req.admin?.id || null,
  });

  // Get updated member
  const updatedMember = await Member.findById(memberId);

  res.json({
    success: true,
    message: `Money ${type === 'credit' ? 'added' : 'deducted'} successfully`,
    transaction,
    newBalance: updatedMember.walletBalance,
  });
});

module.exports = {
  getWalletBalance,
  getWalletTransactions,
  addMoneyToWallet,
  deductMoneyFromWallet,
  getAllWalletTransactions,
  adminWalletTransaction,
};
