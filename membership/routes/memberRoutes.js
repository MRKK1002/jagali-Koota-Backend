const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
  deleteMember,
  uploadDocument,
  uploadPhoto,
  scanMemberQR,
  registerPartialMember,
} = require("../controllers/memberController");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Admin routes (add admin auth middleware later)
router.post("/create", createMember);
router.post("/register-partial", registerPartialMember);
router.get("/all", getAllMembers);
router.get("/:id", getMemberById);
router.put("/:id", updateMember);
router.delete("/:id", deleteMember);
router.post("/upload-document", upload.single("document"), uploadDocument);
router.post("/upload-photo", upload.single("photo"), uploadPhoto);

// QR scan route (for counter/staff)
router.post("/scan-qr", scanMemberQR);

module.exports = router;
