const express = require("express");
const router = express.Router();
const couponController = require("../controller/couponController");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/offer");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer();

// Coupon routes
router.post("/", upload.single("image"), couponController.createCoupon);
router.get("/", couponController.getAllCoupons);
router.get("/:id", couponController.getCouponById);
router.put("/:id", upload.single("image"), couponController.updateCoupon);
router.delete("/:id", couponController.deleteCoupon);
router.post("/validate", couponController.validateCoupon);
router.post("/apply", couponController.applyCoupon);

module.exports = router;