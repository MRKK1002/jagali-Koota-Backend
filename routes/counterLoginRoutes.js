const express = require("express")
const router = express.Router()
const counterLoginController = require("../controller/counterLoginController")

// Counter Registration Routes
router.post("/register/send-otp", counterLoginController.sendOtpForCounterRegistration)
router.post("/register/resend-otp", counterLoginController.resendOtpForCounterRegistration)

// Counter Login Routes
router.post("/login/send-otp", counterLoginController.sendOtpForCounterLogin)
router.post("/verify-otp", counterLoginController.verifyOtpForCounter)
router.post("/login/resend-otp", counterLoginController.resendOtpForCounterLogin)

// Counter CRUD Routes (for admin management)
router.get("/", counterLoginController.getAllCounters)
router.post("/register", counterLoginController.registerCounter)
router.put("/:id", counterLoginController.updateCounter)
router.delete("/:id", counterLoginController.deleteCounter)

module.exports = router