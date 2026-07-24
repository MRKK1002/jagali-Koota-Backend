const mongoose = require("mongoose")

const invoiceItemSchema = new mongoose.Schema({
  menuItemId: {
    type: String,
    required: true,
  },
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
    min: [1, "Quantity cannot be less than 1"],
  },
  image: {
    type: String,
    required: false,
  },
  description: {
    type: String,
    required: false,
  },
})

const staffInvoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffLogin", // Reference to StaffLogin model
      required: false, // Made optional for guest orders
    },
    invoiceId: {
      type: String,
      required: true,
      unique: true,
    },
    orderId: {
      type: String,
      required: true,
      ref: "StaffOrder",
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch ID is required"],
    },
    branchName: {
      type: String,
      required: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: [true, "Table ID is required"],
    },
    tableNumber: {
      type: String,
      required: true,
    },
    peopleCount: {
      type: Number,
      required: true,
      min: [1, "People count cannot be less than 1"],
    },
    items: [invoiceItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    serviceCharge: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    grandTotal: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "completed",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "netbanking", "cash", "wallet"],
      required: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
)

// Add indexes for faster queries
staffInvoiceSchema.index({ userId: 1 })
staffInvoiceSchema.index({ invoiceId: 1 })
staffInvoiceSchema.index({ orderId: 1 })
staffInvoiceSchema.index({ branchId: 1 })
staffInvoiceSchema.index({ tableId: 1 })
staffInvoiceSchema.index({ paymentStatus: 1 })

module.exports = mongoose.model("StaffInvoice", staffInvoiceSchema)