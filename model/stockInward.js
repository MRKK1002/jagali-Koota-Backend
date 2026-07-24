// const mongoose = require('mongoose');

// const stockInwardSchema = new mongoose.Schema({
//     name: {
//         type: String,
//         enum: ["Pending", "Approved", "Rejected"],
//         required: true,
//     },
//     goodsReceiptNoteId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "GoodsReceiptNote",
//         required: true
//     },
//     supplierId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Supplier",
//         required: true
//     },
// });

// module.exports = mongoose.model("StockInward", stockInwardSchema);



const mongoose = require("mongoose")

const stockInwardRequestSchema = new mongoose.Schema(
  {
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      default: "inward",
      enum: ["inward"],
    },
    rawMaterialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true,
    },
    materialName: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreLocation",
      required: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    supplier: {
      type: String,
      default: "Unknown Supplier",
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0.01,
    },
    totalValue: {
      type: Number,
      required: true,
    },
    expiryDate: {
      type: Date,
    },
    batchNumber: {
      type: String,
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedBy: {
      type: String,
    },
    requestedDate: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
    approvalNotes: {
      type: String,
    },
    processed: {
      type: Boolean,
      default: false,
    },
    processedAt: {
      type: Date,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockTransaction",
    },
  },
  {
    timestamps: true,
  },
)

// Index for better query performance
stockInwardRequestSchema.index({ status: 1, processed: 1 })
stockInwardRequestSchema.index({ referenceNumber: 1 })
stockInwardRequestSchema.index({ createdAt: -1 })

module.exports = mongoose.model("StockInwardRequest", stockInwardRequestSchema)