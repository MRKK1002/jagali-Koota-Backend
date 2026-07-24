const express = require("express")
const router = express.Router()
const attendanceController = require("../controller/attendanceController")

// CRUD Routes for Attendance Management
router.get("/", attendanceController.getAllAttendance)
router.get("/:id", attendanceController.getAttendanceById)
router.post("/", attendanceController.createAttendance)
router.put("/:id", attendanceController.updateAttendance)
router.delete("/:id", attendanceController.deleteAttendance)

// Additional Routes
router.get("/summary/:employeeId", attendanceController.getAttendanceSummary)

module.exports = router