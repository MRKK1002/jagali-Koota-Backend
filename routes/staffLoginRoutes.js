const express = require("express")
const router = express.Router()
const staffLoginController = require("../controller/staffLoginController")

// CRUD Routes for Staff Management
router.get("/", staffLoginController.getAllStaff)
router.get("/:id", staffLoginController.getStaffById)
router.post("/register", staffLoginController.registerStaffDirect)
router.put("/:id", staffLoginController.updateStaff)
router.delete("/:id", staffLoginController.deleteStaff)

// OTP-based Registration Routes
router.post("/register/send-otp", staffLoginController.sendOtpForStaffRegistration)
router.post("/register/resend-otp", staffLoginController.resendOtpForStaffRegistration)

// OTP-based Login Routes
router.post("/login/send-otp", staffLoginController.sendOtpForStaffLogin)
router.post("/verify-otp", staffLoginController.verifyOtpForStaff)
router.post("/login/resend-otp", staffLoginController.resendOtpForStaffLogin)

module.exports = router