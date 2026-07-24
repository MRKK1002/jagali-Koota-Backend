const express = require("express")
const router = express.Router()
const productSubmissionController = require("../controller/productSubmissionController")
const multer = require("multer")

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination based on file type
    let destination = "uploads/payment-images"
    if (file.fieldname === "qrCode") {
      destination = "uploads/qr-codes"
    } else if (file.fieldname === "paymentImage") {
      destination = "uploads/payment-images"
    } else if (file.fieldname === "billImage") {
      destination = "uploads/bill-images"
    }
    cb(null, destination)
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname)
  },
})

const upload = multer({

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
})

// Submission routes
router.post("/", productSubmissionController.createSubmission)
router.get("/", productSubmissionController.getAllSubmissions)
router.get("/user/:userPhone", productSubmissionController.getUserSubmissions)
router.get("/approved/:userPhone", productSubmissionController.getApprovedSubmissions)
router.get("/payment-uploaded/:userPhone", productSubmissionController.getPaymentUploadedSubmissions)
router.get("/stats", productSubmissionController.getSubmissionStats)
router.get("/:submissionId", productSubmissionController.getSubmissionById)

// Status and approval routes
router.put("/status/:submissionId", productSubmissionController.updateSubmissionStatus)
router.put("/:submissionId/approve", productSubmissionController.approveSubmission)
router.put("/:submissionId/reject", productSubmissionController.rejectSubmission)
router.put("/:submissionId/complete", productSubmissionController.completeSubmission)

// File upload routes
router.post("/qr-upload/:submissionId", upload.single("qrCode"), productSubmissionController.uploadQRCode)
router.post(
  "/:submissionId/upload-payment-image",
  upload.single("paymentImage"),
  productSubmissionController.uploadPaymentImage,
)
router.post("/:submissionId/upload-bill-image", upload.single("billImage"), productSubmissionController.uploadBillImage)

// Delete route
router.delete("/:submissionId", productSubmissionController.deleteSubmission)

module.exports = router