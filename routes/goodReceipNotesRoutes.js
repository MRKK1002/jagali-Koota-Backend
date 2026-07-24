const express = require("express");
const router = express.Router();
const grnController = require("../controller/goodReceiptNotesController");

router.get("/", grnController.getAllGRNs);
router.get("/:id", grnController.getGRN);
router.post("/", grnController.createGRN);
router.put("/:id", grnController.updateGRN);
router.delete("/:id", grnController.deleteGRN);

module.exports = router;