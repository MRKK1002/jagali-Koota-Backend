const express = require("express");
const router = express.Router();
const {
  createPayslip,
  getAllPayslips,
  getPayslipById,
  updatePayslip,
  deletePayslip,
} = require("../controller/payslipController");

router.post("/", createPayslip);

router.get("/", getAllPayslips);

router.get("/:id", getPayslipById);

router.put("/:id", updatePayslip);

router.delete("/:id", deletePayslip);

module.exports = router;