const express = require("express")
const router = express.Router()
const payrollController = require("../controller/payrollController")

// CRUD Routes for Payroll Management
router.get("/", payrollController.getAllPayroll)
router.get("/:id", payrollController.getPayrollById)
router.post("/", payrollController.createPayroll)
router.put("/:id", payrollController.updatePayroll)
router.delete("/:id", payrollController.deletePayroll)

// Additional Routes
router.patch("/:id/mark-paid", payrollController.markAsPaid)
router.post("/generate-from-attendance", payrollController.generatePayrollFromAttendance)

module.exports = router