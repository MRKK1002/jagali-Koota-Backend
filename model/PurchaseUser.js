const mongoose = require("mongoose")

const purchaseUserSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit phone number"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    generatedOtp: {
      type: String,
      default: null,
    },
    otpGeneratedAt: {
      type: Date,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    otpVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

// Index for faster queries
purchaseUserSchema.index({ phoneNumber: 1 })

module.exports = mongoose.model("PurchaseUser", purchaseUserSchema)