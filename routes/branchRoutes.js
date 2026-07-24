const express = require("express")
const router = express.Router()
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
} = require("../controller/branchController")

// Ensure upload directory exists
// const uploadDir = path.join(__dirname, "..", "uploads", "branch")
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true })
//   console.log("Created upload directory:", uploadDir)
// }

// Configure Multer for file uploads (using disk storage for reliability)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/branch');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '_' + file.originalname);
  },
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true)
  } else {
    cb(new Error("Only image files are allowed!"), false)
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
})

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {








  if (err instanceof multer.MulterError) {

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ 
        success: false,
        message: "File too large. Maximum size is 5MB.",
        debug: {
          errorType: "MulterError",
          errorCode: err.code,
          limit: "5MB"
        }
      });
    }
    return res.status(400).json({ 
      success: false,
      message: err.message,
      debug: {
        errorType: "MulterError",
        errorCode: err.code
      }
    });
  } else if (err) {

    return res.status(400).json({ 
      success: false,
      message: err.message,
      debug: {
        errorType: err.constructor.name,
        errorMessage: err.message
      }
    });
  }

  next();
}

// Routes
router.route("/").post(upload.single("image"), handleMulterError, createBranch).get(getBranches)

router
  .route("/:id")
  .get(getBranchById)
  .put(upload.single("image"), handleMulterError, updateBranch)
  .delete(deleteBranch)

module.exports = router