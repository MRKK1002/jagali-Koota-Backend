const express = require("express");
const router = express.Router();
const {
  loginMember,
  getMemberProfile,
  updateMemberProfile,
  changePassword,
  forgotPassword,
} = require("../controllers/memberAuthController");
const { protectMember } = require("../middleware/memberAuth");

// Public routes
router.post("/login", loginMember);
router.post("/forgot-password", forgotPassword);

// Protected routes (require member authentication)
router.get("/profile", protectMember, getMemberProfile);
router.put("/update-profile", protectMember, updateMemberProfile);
router.post("/change-password", protectMember, changePassword);

module.exports = router;
