const express = require("express")
const router = express.Router()
const staffInvoiceController = require("../controller/staffInvoiceController")

// Create invoice from order
router.post("/create-from-order", staffInvoiceController.createInvoiceFromOrder)

// Get invoices by userId - NEW ROUTE
router.get("/user/:userId", staffInvoiceController.getInvoicesByUserId)

// Get all invoices with optional filtering
router.get("/", staffInvoiceController.getAllInvoices)

// Get invoice statistics
router.get("/statistics", staffInvoiceController.getInvoiceStatistics)

// Get daily revenue report
router.get("/daily-revenue", staffInvoiceController.getDailyRevenueReport)

// Get invoices by order ID - MUST BE BEFORE /:id route
router.get("/order/:orderId", staffInvoiceController.getInvoicesByOrderId)

// Get invoice by invoice ID - MUST BE BEFORE /:id route
router.get("/invoice/:invoiceId", staffInvoiceController.getInvoiceByInvoiceId)

// Get invoice by ID
router.get("/:id", staffInvoiceController.getInvoiceById)

// Update invoice
router.put("/:id", staffInvoiceController.updateInvoice)

// Delete invoice
router.delete("/:id", staffInvoiceController.deleteInvoice)

module.exports = router