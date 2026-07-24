const mongoose = require("mongoose")

const sOrderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: String, // Changed to String to match frontend item IDs
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
  gstRate: {
    type: Number,
    default: 0, // GST percentage for this item
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
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Categoryy",
    required: false,
  },
  kotNumber: {
    type: String,
    required: false,
  },
})

const staffOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffLogin", // Reference to StaffLogin model
      required: false, // CHANGED: Made optional for guest orders
    },
    // NEW FIELDS FOR GUEST ORDERS
    customerName: {
      type: String,
      required: false, // Required for guest orders, optional for staff orders
      trim: true,
    },
    customerMobile: {
      type: String,
      required: false, // Required for guest orders, optional for staff orders
      validate: {
        validator: (v) => {
          // Only validate if value is provided
          return !v || /^[0-9]{10}$/.test(v)
        },
        message: "Mobile number must be 10 digits",
      },
    },
    isGuestOrder: {
      type: Boolean,
      default: false, // NEW: Flag to identify guest orders
    },
    orderId: {
      type: String,
      required: true,
      // Removed unique constraint - will use compound index instead
    },
    kotNumber: {
      type: String,
      required: false, // Will be auto-generated
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
    },
    parentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffOrder",
      required: false, // Only set for additional orders (when adding more items)
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch ID is required"],
    },
    branchName: {
      type: String,
      required: true, // Store branch name for easy access
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categoryy",
      required: false, // Optional - for filtering orders by category
    },
    categoryName: {
      type: String,
      required: false, // Store category name for easy access
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: false, // Made optional for guest orders from QR codes
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
    items: [sOrderItemSchema],
    status: {
      type: String,
      enum: ["pending", "preparing", "served", "completed", "cancelled"],
      default: "pending",
    },
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
      default: function () {
        // Default to pending for guest orders, completed for staff orders
        return this.isGuestOrder ? "pending" : "completed"
      },
    },
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "netbanking", "cash", "wallet"],
      required: true,
    },
    // NEW FIELD ADDED - to track when payment was last updated
    paymentUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    billPrinted: {
      type: Boolean,
      default: false, // Track if bill has been printed
    },
    billPrintedAt: {
      type: Date,
      required: false, // When the bill was printed
    },
    // Complimentary bill fields
    isComplimentary: {
      type: Boolean,
      default: false,
    },
    complimentaryReason: {
      type: String,
      required: false,
    },
    complimentaryMarkedAt: {
      type: Date,
      required: false,
    },
    // Discount fields
    originalGrandTotal: {
      type: Number,
      required: false, // Store original total before discount
    },
    discountType: {
      type: String,
      enum: ["percentage", "amount"],
      required: false,
    },
    discountValue: {
      type: Number,
      required: false,
    },
    discountAmount: {
      type: Number,
      required: false,
    },
    discountReason: {
      type: String,
      required: false,
    },
    discountAppliedAt: {
      type: Date,
      required: false,
    },
    // Cancellation fields
    cancellationReason: {
      type: String,
      required: false,
    },
    cancelledBy: {
      type: String,
      required: false,
    },
    cancelledAt: {
      type: Date,
      required: false,
    },
    orderTime: {
      type: Date,
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

// UPDATED: Custom validation to ensure either userId OR (customerName + customerMobile) is provided
staffOrderSchema.pre("validate", function (next) {
  if (this.isGuestOrder) {
    // For guest orders, require customerName and customerMobile
    if (!this.customerName || !this.customerMobile) {
      return next(new Error("Guest orders require customerName and customerMobile"))
    }
    // Validate mobile number format for guest orders
    if (!/^[0-9]{10}$/.test(this.customerMobile)) {
      return next(new Error("Mobile number must be 10 digits"))
    }
  } else {
    // For staff orders, require userId
    if (!this.userId) {
      return next(new Error("Staff orders require userId"))
    }
  }
  next()
})


// Generate unique order ID and KOT number before saving
staffOrderSchema.pre("save", async function (next) {
  try {
    const StaffOrder = mongoose.model("StaffOrder")
    
    // Generate Order ID if needed
    if (
      !this.orderId ||
      this.orderId.startsWith("GUEST-") ||
      this.orderId.startsWith("STAFF-") ||
      this.orderId.startsWith("TEMP-") ||
      this.orderId.startsWith("MOBILE-")
    ) {

      // Find all orders for this branch and EXACT category name (not just prefix)
      // This ensures "Rns" and "RNS self Service" have separate sequences
      const filter = {
        branchId: this.branchId // Same branch
      }
      
      // Add category filter only if category name exists
      if (this.categoryName) {
        filter.categoryName = this.categoryName // Exact category name match
      } else {
        // If no category, filter by orders with no category
        filter.categoryName = { $in: [null, undefined, ""] }
      }

      // Find all orders for this category to determine the next sequence number
      const allOrders = await StaffOrder.find(filter).sort({ createdAt: -1 })

      if (allOrders.length > 0) {
      }

      let maxSequence = 0
      
      // Extract sequence numbers from order IDs
      allOrders.forEach(order => {
        if (order.orderId) {
          // Try to parse as pure number first (001, 002, etc.)
          const pureNumber = parseInt(order.orderId)
          if (!isNaN(pureNumber)) {
            if (pureNumber > maxSequence) {
              maxSequence = pureNumber
            }
          } else {
            // Fallback: Extract number from format with prefix: "CAT-001", "CAT-002", etc.
            const match = order.orderId.match(/-(\d+)$/)
            if (match) {
              const number = parseInt(match[1])
              if (!isNaN(number) && number > maxSequence) {
                maxSequence = number
              }
            }
          }
        }
      })

      // Next sequence is max + 1
      const sequence = maxSequence + 1


      // Format as just the number: 001, 002, 003, etc. (no prefix)
      this.orderId = sequence.toString().padStart(3, '0')
      
    }
    
    // Generate KOT Number ONLY for Restaurant category (only for new orders)
    // SKIP if kotNumber is already set by controller (to avoid overwriting global KOT)
    if (!this.kotNumber && this.isNew) {
    }
    
    next()
  } catch (error) {
    console.error("❌ Error in pre-save hook:", error)
    next(error)
  }
})

// Add indexes for faster queries
staffOrderSchema.index({ userId: 1 })
// Removed simple orderId index - using compound index instead
// REMOVED: staffOrderSchema.index({ kotNumber: 1 }) - kotNumber should NOT be unique
staffOrderSchema.index({ branchId: 1, tableId: 1 })
staffOrderSchema.index({ branchName: 1, tableNumber: 1 })
staffOrderSchema.index({ status: 1 })
staffOrderSchema.index({ paymentStatus: 1 })
staffOrderSchema.index({ paymentMethod: 1 })
staffOrderSchema.index({ isGuestOrder: 1 }) // NEW INDEX
staffOrderSchema.index({ customerMobile: 1 }) // NEW INDEX for guest orders
// Compound unique index: orderId must be unique per branch and category
staffOrderSchema.index({ branchId: 1, categoryName: 1, orderId: 1 }, { unique: true })

module.exports = mongoose.model("StaffOrder", staffOrderSchema)