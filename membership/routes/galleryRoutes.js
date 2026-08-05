const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  uploadGalleryImages,
  getAllGalleryImages,
  updateGalleryImage,
  deleteGalleryImage,
} = require("../controllers/galleryController");

// Multer setup for image uploads (memory storage, same as events/members)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
});

// Public route — Member App fetches gallery from here
router.get("/all", getAllGalleryImages);

// Admin routes (add admin auth middleware when available)
router.post("/upload", upload.array("images", 20), uploadGalleryImages);
router.put("/:id", upload.array("images", 1), updateGalleryImage);
router.delete("/:id", deleteGalleryImage);

module.exports = router;
