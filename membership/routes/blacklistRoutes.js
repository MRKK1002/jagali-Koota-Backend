const express = require("express");
const router = express.Router();
const {
  addToBlacklist,
  getAllBlacklisted,
  checkBlacklist,
  removeFromBlacklist,
  updateBlacklistEntry,
  deleteBlacklistEntry,
} = require("../controllers/blacklistController");

// Admin routes
router.post("/add", addToBlacklist);
router.get("/all", getAllBlacklisted);
router.get("/check", checkBlacklist);
router.put("/remove/:id", removeFromBlacklist);
router.put("/update/:id", updateBlacklistEntry);
router.delete("/:id", deleteBlacklistEntry);

module.exports = router;
