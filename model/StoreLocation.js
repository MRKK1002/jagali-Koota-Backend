const mongoose = require("mongoose")

const storeLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Location name is required"],
      trim: true,
      maxlength: [100, "Location name cannot exceed 100 characters"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },
    manager: {
      type: String,
      required: [true, "Manager name is required"],
      trim: true,
      maxlength: [100, "Manager name cannot exceed 100 characters"],
    },
    contact: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
      validate: {
        validator: (v) => /^\+?[\d\s\-$$$$]+$/.test(v),
        message: "Please enter a valid contact number",
      },
    },
    itemCount: {
      type: Number,
      default: 0,
      min: [0, "Item count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

// Index for better query performance
storeLocationSchema.index({ name: 1 })
storeLocationSchema.index({ isActive: 1 })
storeLocationSchema.index({ createdBy: 1 })

module.exports = mongoose.model("StoreLocation", storeLocationSchema)