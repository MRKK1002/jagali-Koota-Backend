const mongoose = require("mongoose")

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Item name is required"],
    trim: true
  },
  category: {
    type: String,
    required: [true, "Category is required"],
    enum: ["Kitchen", "Bar", "Housekeeping", "Maintenance", "Office", "Other"]
  },
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: 0
  },
  unit: {
    type: String,
    required: [true, "Unit is required"],
    enum: ["pieces", "kg", "liters", "packets", "boxes"]
  },
  minStockLevel: {
    type: Number,
    required: [true, "Minimum stock level is required"],
    min: 0
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: 0
  },
  supplier: {
    type: String,
    required: [true, "Supplier name is required"]
  },
  location: {
    type: String,
    required: [true, "Storage location is required"]
  },
  status: {
    type: String,
    enum: ["In Stock", "Low Stock", "Out of Stock"],
    default: "In Stock"
  }
}, {
  timestamps: true
})

module.exports = mongoose.model("InventoryItem", inventoryItemSchema)