const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    image: {
      type: String, // e.g. /uploads/gallery/1712345678-photo.jpg
      required: [true, "Image is required"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

gallerySchema.index({ isActive: 1, createdAt: -1 });

const Gallery = mongoose.model("Gallery", gallerySchema);

module.exports = Gallery;
