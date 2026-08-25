const mongoose = require("mongoose")

const cOrderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu",
    required: false,
    default: null,
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
  gstRate: {
    type: Number,
    default: 0,
    min: [0, "GST rate cannot be negative"],
  },
  isComplimentary: {
    type: Boolean,
    default: false,
  },
  // Non-chargeable at item level — internal consumption (staff meal, tasting,
  // wastage). Distinct from complimentary, which is a customer-facing goodwill
  // give-away. Both cost nothing, but they are accounted differently.
  isNonChargeable: {
    type: Boolean,
    default: false,
  },
  remark: {
    type: String,
    trim: true,
    default: null,
  },
})

const counterOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Counter",
    required: false,
    default: null,
  },
  customerName: {
    type: String,
    required: false,
    trim: true,
    default: 'Walk-in Customer',
  },
  phoneNumber: {
    type: String,
    required: false,
    trim: true,
    default: '0000000000',
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: [true, "Branch is required"],
  },
  branchName: {
    type: String,
    trim: true,
    default: null,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  categoryName: {
    type: String,
    trim: true,
    default: null,
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CounterInvoice",
    required: false, // Make optional for KOT orders
    default: null,
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Table",
    default: null,
  },
  tableNumber: {
    type: String,
    default: null,
  },
  serverName: {
    type: String,
    trim: true,
    default: null,
  },
  kotNumber: {
    type: String,
    default: null,
  },
  kotTime: {
    type: Date,
    default: null,
  },
  invoiceNumber: {
    type: String,
    default: null,
    trim: true,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, "Discount amount cannot be negative"],
  },
  discount: {
    type: {
      type: String,
      enum: ["percentage", "amount"],
    },
    value: {
      type: Number,
      min: [0, "Discount value cannot be negative"],
    },
    amount: {
      type: Number,
      min: [0, "Discount amount cannot be negative"],
    },
    remark: {
      type: String,
      trim: true,
    },
  },
  isComprehensiveBill: {
    type: Boolean,
    default: false,
  },
  isSplitBill: {
    type: Boolean,
    default: false,
  },
  originalKOTIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "CounterOrder",
  }],
  consolidatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CounterOrder",
    default: null,
  },
  items: [cOrderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: [0, "Subtotal cannot be negative"],
  },
  gstAmount: {
    type: Number,
    default: 0,
    min: [0, "GST amount cannot be negative"],
  },
  tax: {
    type: Number,
    required: true,
    min: [0, "Tax cannot be negative"],
  },
  serviceCharge: {
    type: Number,
    required: true,
    min: [0, "Service charge cannot be negative"],
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, "Total amount cannot be negative"],
  },
  grandTotal: {
    type: Number,
    required: true,
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

  // ─── Non-chargeable ──────────────────────────────────────────────────────
  // Internal consumption: staff meals, management/owner, tasting, wastage.
  // Kept separate from complimentary so month-end reporting can show
  // "spent on customers" and "consumed internally" as different figures.
  isNonChargeable: {
    type: Boolean,
    default: false,
  },
  nonChargeableReason: {
    type: String,
    trim: true,
    default: null,
  },
  nonChargeableType: {
    type: String,
    enum: ["staff", "management", "tasting", "wastage", "other", null],
    default: null,
  },
  nonChargeableBy: {
    type: String,
    trim: true,
    default: null,
  },
  nonChargeableAt: {
    type: Date,
    default: null,
  },
  // Amount before it was zeroed out, so reports can show what it cost
  originalGrandTotal: {
    type: Number,
    default: null,
  },

  paymentMethod: {
    type: String,
    required: [true, "Payment method is required"],
    enum: ["cash", "card", "upi", "qr", "wallet"],
  },
  orderStatus: {
    type: String,
    required: [true, "Order status is required"],
    enum: ["pending", "processing", "completed", "cancelled"],
    default: "processing",
  },
  paymentStatus: {
    type: String,
    required: [true, "Payment status is required"],
    enum: ["pending", "completed", "failed", "refunded", "consolidated", "billed"],
    default: "pending",
  },
  // Settlement details — filled when a 'billed' order is settled (payment collected)
  settlementDetails: {
    method: {
      type: String,
      enum: ["cash", "upi", "card", null],
      default: null,
    },
    utr: {
      type: String,
      trim: true,
      default: null,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    settledBy: {
      type: String,
      trim: true,
      default: null,
    },
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    default: null,
  },
  cancelledBy: {
    type: String,
    trim: true,
    maxlength: [100, "Cancelled by name cannot exceed 100 characters"],
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Business day (YYYY-MM-DD) this order belongs to, honouring the late-night
  // cutoff. Stored rather than derived so it can back a unique index — invoice
  // numbers restart at 001 daily, so uniqueness is only meaningful per day.
  businessDay: {
    type: String,
    default: null,
  },
})

// ─── Uniqueness ────────────────────────────────────────────────────────────
// A bill is unique per branch + business day + invoice number. Without this,
// the offline sync queue's retries created duplicate bills (invoice 015 once
// reached 8 copies), silently inflating revenue. The application-level check in
// createCounterOrder catches sequential retries; this index is what stops two
// concurrent requests from both slipping through.
//
// Partial filter: applies only to real bills — KOTs have no invoiceNumber, and
// several KOTs per day is normal.
counterOrderSchema.index(
  { branch: 1, businessDay: 1, invoiceNumber: 1 },
  {
    unique: true,
    name: "uniq_bill_per_branch_day",
    partialFilterExpression: {
      invoiceNumber: { $type: "string" },
      businessDay: { $type: "string" },
    },
  }
)

// Add indexes for better query performance
counterOrderSchema.index({ userId: 1, createdAt: -1 })
counterOrderSchema.index({ orderStatus: 1 })
counterOrderSchema.index({ paymentStatus: 1 })
counterOrderSchema.index({ branch: 1 })
counterOrderSchema.index({ categoryName: 1 })
counterOrderSchema.index({ createdAt: -1 })
counterOrderSchema.index({ customerName: 1 })
counterOrderSchema.index({ phoneNumber: 1 })
counterOrderSchema.index({ invoiceNumber: 1 })
counterOrderSchema.index({ kotNumber: 1 })
counterOrderSchema.index({ isComplimentary: 1 })
counterOrderSchema.index({ isNonChargeable: 1 })
// Compound indexes for common query patterns (faster filtering)
counterOrderSchema.index({ branch: 1, categoryName: 1, createdAt: -1 })
counterOrderSchema.index({ branch: 1, createdAt: -1 })
counterOrderSchema.index({ categoryName: 1, createdAt: -1 })
counterOrderSchema.index({ branch: 1, categoryName: 1, paymentStatus: 1 })
// Text search index for customer name, phone, invoice, KOT
counterOrderSchema.index({ 
  customerName: 'text', 
  phoneNumber: 'text', 
  invoiceNumber: 'text', 
  kotNumber: 'text' 
})

module.exports = mongoose.model("CounterOrder", counterOrderSchema)