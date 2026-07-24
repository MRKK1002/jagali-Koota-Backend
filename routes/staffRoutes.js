const express = require("express")
const router = express.Router()
const staffController = require("../controller/staffController")

// CRUD Routes for Staff Management
router.get("/", staffController.getAllStaff)
router.get("/:id", staffController.getStaffById)
router.post("/", staffController.createStaff)
router.put("/:id", staffController.updateStaff)
router.delete("/:id", staffController.deleteStaff)

// Additional Routes
router.patch("/:id/toggle-status", staffController.toggleStaffStatus)

module.exports = router