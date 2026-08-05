const asyncHandler = require("express-async-handler");
const fs = require("fs");
const path = require("path");
const Gallery = require("../models/Gallery");

const UPLOAD_DIR = path.join(__dirname, "../../uploads/gallery");

// Save a multer memory-storage file to /uploads/gallery and return its public path
const saveImageFile = (file) => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  const safeName = String(file.originalname || "image").replace(/[^\w.\-]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), file.buffer);
  return `/uploads/gallery/${fileName}`;
};

// Delete a stored image file (best effort)
const deleteImageFile = (imagePath) => {
  if (!imagePath) return;
  try {
    const fileName = path.basename(imagePath);
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Error deleting gallery image file:", error.message);
  }
};

// @desc    Upload one or more gallery images (Admin)
// @route   POST /api/v1/hotel/gallery/upload
// @access  Private/Admin
const uploadGalleryImages = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error("Please select at least one image to upload");
  }

  const created = [];

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    try {
      const imagePath = saveImageFile(file);

      // When multiple files are uploaded with one title, suffix the title
      const itemTitle =
        req.files.length > 1
          ? `${title || "Gallery Image"} ${i + 1}`
          : title || "Gallery Image";

      const item = await Gallery.create({
        title: itemTitle,
        image: imagePath,
        description: description || "",
        createdBy: req.admin?.id || req.user?.id || null,
      });

      created.push(item);
    } catch (error) {
      console.error("Error saving gallery image:", error.message);
    }
  }

  if (created.length === 0) {
    res.status(500);
    throw new Error("Failed to upload images");
  }

  res.status(201).json({
    success: true,
    message: `${created.length} image(s) uploaded successfully`,
    count: created.length,
    images: created,
  });
});

// @desc    Get all gallery images (Public - used by Member App and Admin)
// @route   GET /api/v1/hotel/gallery/all
// @access  Public
const getAllGalleryImages = asyncHandler(async (req, res) => {
  const { includeInactive, limit = 200 } = req.query;

  const query = {};

  // Admin can request inactive items too; app only gets active ones
  if (includeInactive !== "true") {
    query.isActive = true;
  }

  const images = await Gallery.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  res.json({
    success: true,
    count: images.length,
    images,
  });
});

// @desc    Update gallery image details (Admin)
// @route   PUT /api/v1/hotel/gallery/:id
// @access  Private/Admin
const updateGalleryImage = asyncHandler(async (req, res) => {
  const { title, description, isActive } = req.body;

  const item = await Gallery.findById(req.params.id);

  if (!item) {
    res.status(404);
    throw new Error("Gallery image not found");
  }

  if (title !== undefined) item.title = title;
  if (description !== undefined) item.description = description;
  if (isActive !== undefined) item.isActive = isActive === true || isActive === "true";

  // Replace the image file if a new one was uploaded
  if (req.files && req.files.length > 0) {
    const oldImage = item.image;
    item.image = saveImageFile(req.files[0]);
    deleteImageFile(oldImage);
  }

  await item.save();

  res.json({
    success: true,
    message: "Gallery image updated successfully",
    image: item,
  });
});

// @desc    Download a gallery image as a file attachment
// @route   GET /api/v1/hotel/gallery/:id/download
// @access  Public
// Sends Content-Disposition: attachment so browsers save the file instead of
// rendering it inline (which is what happens when hitting /uploads/... directly).
const downloadGalleryImage = asyncHandler(async (req, res) => {
  const item = await Gallery.findById(req.params.id);

  if (!item) {
    res.status(404);
    throw new Error("Gallery image not found");
  }

  // basename guards against path traversal via a tampered stored value
  const fileName = path.basename(item.image || "");
  const filePath = path.join(UPLOAD_DIR, fileName);

  if (!fileName || !fs.existsSync(filePath)) {
    res.status(404);
    throw new Error("Image file not found on server");
  }

  // Friendly filename built from the title, keeping the original extension
  const ext = path.extname(fileName) || ".jpg";
  const safeTitle =
    String(item.title || "gallery-image")
      .trim()
      .replace(/[^\w\s\-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase() || "gallery-image";

  res.download(filePath, `${safeTitle}${ext}`, (err) => {
    if (err && !res.headersSent) {
      console.error("Error sending gallery download:", err.message);
      res.status(500).json({
        success: false,
        message: "Failed to download image",
      });
    }
  });
});

// @desc    Delete gallery image (Admin)
// @route   DELETE /api/v1/hotel/gallery/:id
// @access  Private/Admin
const deleteGalleryImage = asyncHandler(async (req, res) => {
  const item = await Gallery.findById(req.params.id);

  if (!item) {
    res.status(404);
    throw new Error("Gallery image not found");
  }

  deleteImageFile(item.image);
  await item.deleteOne();

  res.json({
    success: true,
    message: "Gallery image deleted successfully",
  });
});

module.exports = {
  uploadGalleryImages,
  getAllGalleryImages,
  downloadGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
};
