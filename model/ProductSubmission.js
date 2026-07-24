const mongoose = require("mongoose");

const productSubmissionSchema = new mongoose.Schema(
  {
    submissionId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseUser",
      required: true,
    },
    userPhone: {
      type: String,
      required: true,
    },
    products: [
      {
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        unit: {
          type: String,
          default: "pcs",
        },
        description: {
          type: String,
          default: "",
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "submitted",
        "pending",
        "approved",
        "qr_uploaded",
        "payment_uploaded",
        "rejected",
        "completed",
      ],
      enum: [
        "submitted",
        "pending",
        "approved",
        "qr_uploaded",
        "payment_uploaded",
        "bill_uploaded",
        "rejected",
        "completed",
      ],
      default: "submitted",
    },
    qrCodeUri: {
      type: String,
      default: null,
    },
    paymentImageUri: {
      type: String,
      default: null,
    },
    billImageUri: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    paymentUploadedAt: {
      type: Date,
      default: null,
    },
    billUploadedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ProductSubmission", productSubmissionSchema);