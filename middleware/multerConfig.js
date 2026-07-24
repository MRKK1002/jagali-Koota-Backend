const multer = require("multer");
const path = require("path");
// Set storage engine for memory (required for AWS S3 upload)
const storage = multer.memoryStorage();
// Initialize upload
 const upload = multer({
    storage: storage,
    limits: { fileSize: 50000000 },
    fileFilter: (req, file, cb) => {
        checkFileType(file, cb);
    }
});
// Check file type
function checkFileType(file, cb) {
    // Allowed file extensions for images and videos
    const filetypes = /jpeg|jpg|png|gif|mp4|avi|mkv|mov|webm/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error("Images and Videos Only!"));
    }
}
module.exports = upload; 