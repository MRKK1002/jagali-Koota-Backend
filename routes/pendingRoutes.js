const express = require("express");
const router = express.Router();
const controller = require("../controller/pendingController");

router.post("/", controller.createPendingPO);
router.get("/", controller.getAllPendingPOs);
router.get("/:id", controller.getPendingPOById);
router.put("/:id", controller.updatePendingPO);
router.delete("/:id", controller.deletePendingPO);

module.exports = router;