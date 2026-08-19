const express = require("express")
const router = express.Router()
const billingSessionController = require("../controller/billingSessionController")

// Current day's session state + live unsettled/open-KOT counts
router.get("/current", billingSessionController.getCurrentSession)

// Numbers for the pre-close confirmation dialog
router.get("/preview-close", billingSessionController.previewClose)

// Past Z-Reports
router.get("/", billingSessionController.listSessions)

// Open / close / reopen
router.post("/open", billingSessionController.openSession)
router.post("/close", billingSessionController.closeSession)
router.post("/reopen", billingSessionController.reopenSession)

module.exports = router
