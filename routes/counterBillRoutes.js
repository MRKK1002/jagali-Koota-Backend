const express = require("express")
const router = express.Router()
const counterBillController = require("../controller/counterBillController")

// List counter bills with optional filters (e.g., branch, customer, date range)
// This route should come BEFORE the /:id route to avoid conflicts
router.get("/", counterBillController.listCounterBills)

// Get complimentary bills statistics
router.get("/complimentary/stats", counterBillController.getComplimentaryStats)

// Create a new counter bill
router.post("/", counterBillController.createCounterBill)

// Get a counter bill by ID
router.get("/:id", counterBillController.getCounterBillById)

module.exports = router