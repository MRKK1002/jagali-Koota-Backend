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

// Member routes (protected)
router.get("/balance", protectMember, getWalletBalance);
router.get("/transactions", protectMember, getWalletTransactions);

// Admin routes (add admin auth middleware later)
router.post("/add-money", addMoneyToWallet);
router.post("/deduct", deductMoneyFromWallet);
router.post("/admin-transaction", adminWalletTransaction);
router.get("/all-transactions", getAllWalletTransactions);

module.exports = router;
