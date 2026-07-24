const express = require("express")
const router = express.Router()
const termsController = require("../controller/termsController")

// Terms & Policies routes
router.get("/", termsController.getTerms)
router.get("/:id", termsController.getTermById)

// Admin routes
router.post("/", termsController.createTerm)
router.put("/:id", termsController.updateTerm)
router.delete("/:id", termsController.deleteTerm)

module.exports = router