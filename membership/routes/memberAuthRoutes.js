const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  loginMember,
  getMemberProfile,
  updateMemberProfile,
  changePassword,
  forgotPassword,
  checkPhone,
  completeRegistration,
} = require("../controllers/memberAuthController");
const { protectMember } = require("../middleware/memberAuth");

// Multer setup for document uploads during registration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Public routes
router.post("/login", loginMember);
router.post("/forgot-password", forgotPassword);
router.post("/check-phone", checkPhone);
router.post("/complete-registration", completeRegistration);

// Protected routes (require member authentication)
router.get("/profile", protectMember, getMemberProfile);
router.put("/update-profile", protectMember, updateMemberProfile);
router.post("/change-password", protectMember, changePassword);

module.exports = router;
