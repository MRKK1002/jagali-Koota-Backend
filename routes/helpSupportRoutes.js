const express = require("express")
const router = express.Router()
const helpSupportController = require("../controller/helpSupportController")

// Help & Support routes
router.get("/", helpSupportController.getHelpSupport)

// Admin routes
router.post("/", helpSupportController.createHelpSupport)
router.get("/all", helpSupportController.getAllHelpSupport)
router.put("/:id", helpSupportController.updateHelpSupport)
router.delete("/:id", helpSupportController.deleteHelpSupport)

module.exports = router