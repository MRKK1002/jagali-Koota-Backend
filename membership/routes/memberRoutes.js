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
  scanMemberQR,
} = require("../controllers/memberController");

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Admin routes (add admin auth middleware later)
router.post("/create", createMember);
router.get("/all", getAllMembers);
router.get("/:id", getMemberById);
router.put("/:id", updateMember);
router.delete("/:id", deleteMember);
router.post("/upload-document", upload.single("document"), uploadDocument);

// QR scan route (for counter/staff)
router.post("/scan-qr", scanMemberQR);

module.exports = router;
