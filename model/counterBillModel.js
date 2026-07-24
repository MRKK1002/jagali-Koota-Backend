const mongoose = require("mongoose")

const counterBillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Counter",
    required: [true, "User ID is required"],
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CounterOrder",
    required: [true, "Order is required"],
    unique: true,
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CounterInvoice",
    required: [true, "Invoice is required"],
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: [true, "Branch is required"],
  },
  customerName: {
    type: String,
    required: [true, "Customer name is required"],
    trim: true,
  },
  phoneNumber: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
    match: [/^\d{10}$/, "Phone number must be a 10-digit number"],
  },
  items: [
    {
      menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Menu",
        required: [true, "Menu item ID is required"],
      },
      name: {
        type: String,
        required: [true, "Item name is required"],
        trim: true,
      },
      quantity: {
        type: Number,
        required: [true, "Quantity is required"],
        min: [1, "Quantity must be at least 1"],
      },
      price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"],
      },
    },
  ],
  subtotal: {
    type: Number,
    required: [true, "Subtotal is required"],
    min: [0, "Subtotal cannot be negative"],
  },
  tax: {
    type: Number,
    required: [true, "Tax is required"],
    min: [0, "Tax cannot be negative"],
  },
  serviceCharge: {
    type: Number,
    required: [true, "Service charge is required"],
    min: [0, "Service charge cannot be negative"],
  },
  totalAmount: {
    type: Number,
    required: [true, "Total amount is required"],
    min: [0, "Total amount cannot be negative"],
  },
  grandTotal: {
    type: Number,
    required: [true, "Grand total is required"],
    min: [0, "Grand total cannot be negative"],
  },
  isComplimentary: {
    type: Boolean,
    default: false,
  },
  complimentaryReason: {
    type: String,
    trim: true,
    default: null,
  },
  date: {
    type: String,
    required: [true, "Date is required"],
    trim: true,
  },
  time: {
    type: String,
    required: [true, "Time is required"],
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("CounterBill", counterBillSchema)