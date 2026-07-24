const express = require("express")
const router = express.Router()
const purchaseUserController = require("../controller/purchaseUserController")

// Authentication routes
router.post("/send-otp", purchaseUserController.sendOtp)
router.post("/verify-otp", purchaseUserController.verifyOtp)

// Registration route
router.post("/register", purchaseUserController.registerUser)

// User management routes
router.get("/", purchaseUserController.getAllUsers) // Add root endpoint
router.get("/profile/:phoneNumber", purchaseUserController.getUserProfile)
router.get("/all", purchaseUserController.getAllUsers)
router.put("/status/:phoneNumber", purchaseUserController.updateUserStatus)
router.put("/:phoneNumber", purchaseUserController.updateUser)
router.delete("/:phoneNumber", purchaseUserController.deleteUser)

module.exports = router