const express = require("express");
const router = express.Router();
const salesReportController = require("../controller/salesReportController");

router.get("/", salesReportController.getSalesReport);
router.get("/branches", salesReportController.getBranches);
router.get("/order-types", salesReportController.getOrderTypes);

module.exports = router;
