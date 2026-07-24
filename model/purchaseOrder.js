const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    purchaseOrderId: { type: String, unique: true },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "Branch ID is required"],
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch ID is required"],
    },
    orderDate: { type: Date, required: true },
    deliveryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Pending", "In Transit", "Delivered", "Cancelled"],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Overdue"],
    },
    items: [itemSchema],
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    paymentTerms: { type: String, default: "30" },
    grnGenerated: { type: Boolean, default: false },
    grnDate: { type: Date, default: null },
  },
  { timestamps: true }
);

// Middleware to auto-generate employeeId
purchaseOrderSchema.pre("save", async function (next) {
  if (!this.purchaseOrderId) {
    const lastPurchaseOrder = await mongoose
      .model("PurchaseOrder")
      .findOne()
      .sort({ _id: -1 });
    let newId = "PO-001"; // Default for first employee

    if (lastPurchaseOrder && lastPurchaseOrder.purchaseOrderId) {
      const lastIdMatch = lastPurchaseOrder.purchaseOrderId.match(/^PO-(\d+)$/); // Match and extract number
      const lastIdNumber = lastIdMatch ? parseInt(lastIdMatch[1], 10) : 0; // Extract number or default to 0

      newId = `PO-${String(lastIdNumber + 1).padStart(3, "0")}`; // Increment and format
    }

    this.purchaseOrderId = newId;
  }
  next();
});

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);