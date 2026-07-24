const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: false },
    contact: { type: String, required: false },
    email: { type: String, required: false },
    category: { type: String, required: false }, // e.g. "Produce", "Dairy", etc.
    address: { type: String, required: false },
    status: { type: String, default: "Active", required: false }, // "Active" or "Inactive"
    lastOrder: { type: String, default: "Never", required: false }, // e.g. "2024-01-15"
  },
  { timestamps: true }
);

module.exports = mongoose.model("Supplier", supplierSchema);