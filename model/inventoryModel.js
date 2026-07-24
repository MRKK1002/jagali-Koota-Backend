const mongoose = require("mongoose")

// Location Inventory Schema - tracks raw materials at specific locations
const locationInventorySchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreLocation",
      required: true,
    },
    rawMaterialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    expiryDate: {
      type: Date,
    },
    batchNumber: {
      type: String,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Stock Transaction Schema - tracks all stock movements
const stockTransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["inward", "outward", "transfer", "adjustment"],
      required: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreLocation",
      required: true,
    },
    rawMaterialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    reference: {
      type: String,
      required: true,
    },
    source: {
      type: String, // Supplier name, recipe name, etc.
    },
    destination: {
      type: String, // For transfers or outward movements
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

// Compound indexes for better performance
locationInventorySchema.index({ locationId: 1, rawMaterialId: 1 }, { unique: true })
stockTransactionSchema.index({ locationId: 1, rawMaterialId: 1, createdAt: -1 })

module.exports = {
  LocationInventory: mongoose.model("LocationInventory", locationInventorySchema),
  StockTransaction: mongoose.model("StockTransaction", stockTransactionSchema),
}