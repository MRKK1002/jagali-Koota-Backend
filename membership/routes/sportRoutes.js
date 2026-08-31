const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protectMember } = require("../middleware/memberAuth");
const {
  createSport,
  updateSport,
  deleteSport,
  getAllSports,
  getSportById,
  subscribeSport,
  getMySubscriptions,
  cancelSubscription,
  upgradeSubscription,
  getAdminSubscriptions,
} = require("../controllers/sportController");

const storage = multer.memoryStorage();
const upload = multer({ storage });


router.get("/member/my-subscriptions", protectMember, getMySubscriptions);
router.put("/subscriptions/:id/cancel", protectMember, cancelSubscription);
router.put("/subscriptions/:id/upgrade", protectMember, upgradeSubscription);


router.get("/admin/subscriptions", getAdminSubscriptions);
router.post("/", upload.single("image"), createSport);
router.put("/:id", upload.single("image"), updateSport);
router.delete("/:id", deleteSport);


router.get("/", getAllSports);
router.post("/:id/subscribe", protectMember, subscribeSport);
router.get("/:id", getSportById);

module.exports = router;
