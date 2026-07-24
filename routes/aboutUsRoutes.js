const express = require("express");
const router = express.Router();
const aboutUsController = require("../controller/aboutUsController");

// About Us routes
router.get("/", aboutUsController.getAboutUs);

// Admin routes
router.post("/", aboutUsController.createAboutUs);
router.get("/all", aboutUsController.getAllAboutUs);
router.put("/:id", aboutUsController.updateAboutUs);
router.delete("/:id", aboutUsController.deleteAboutUs);

module.exports = router;