const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  loginMember,
  getMemberProfile,
  updateMemberProfile,
  changePassword,
  forgotPassword,
  resetPassword,
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
router.post("/reset-password", resetPassword);
router.post("/check-phone", checkPhone);
router.post("/complete-registration", completeRegistration);

// Protected routes (require member authentication)
router.get("/profile", protectMember, getMemberProfile);
router.put("/update-profile", protectMember, updateMemberProfile);
router.post("/change-password", protectMember, changePassword);

// FCM token registration for push notifications
router.post("/update-fcm-token", protectMember, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: "fcmToken is required" });
    }

    const Member = require("../models/Member");
    await Member.findByIdAndUpdate(req.member.id, { fcmToken });

    res.json({ success: true, message: "FCM token updated" });
  } catch (error) {
    console.error("Error updating FCM token:", error);
    res.status(500).json({ success: false, message: "Failed to update token" });
  }
});
module.exports = router;
