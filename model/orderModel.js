const mongoose = require("mongoose")

const orderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu",
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
    default: null,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
  },
})

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: null,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    deliveryOption: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery",
    },
    deliveryAddress: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "upi"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
       enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    specialInstructions: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "out for delivery", "delivered", "cancelled"],
      default: "pending",
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    deliverySteps: [
      {
        status: {
          type: String,
          required: true,
        },
        time: {
          type: Date,
          default: Date.now,
        },
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Category code mapping for order IDs
const getCategoryCode = async (items) => {
  if (!items || items.length === 0) return "RES"

  try {
    // Get the first item's category to determine the code
    const firstItem = items[0]
    const categoryId = firstItem.categoryId?._id || firstItem.categoryId

    if (categoryId) {
      const Category = mongoose.model("Categoryy")
      const category = await Category.findById(categoryId)

      if (category && category.name) {
        const categoryName = category.name.toLowerCase()
        // Map category names to codes
        if (categoryName.includes("temple")) {
          return "TM" // Temple Meals
        } else if (categoryName.includes("self")) {
          return "SS" // Self Service
        } else if (categoryName.includes("restarunt") || categoryName.includes("restaurant")) {
          return "RES" // Restaurant
        } else if (categoryName.includes("bar") || categoryName.includes("drink")) {
          return "BAR"
        }
        // Use first 2-3 letters of category name as code
        return category.name.substring(0, 3).toUpperCase()
      }
    }
  } catch (error) {
  }

  return "RES" // Default code
}

// Generate unique order number before saving (format: DDMMYYYY-CODE-sequence)
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const now = new Date()
    const day = String(now.getDate()).padStart(2, "0")
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const year = now.getFullYear()
    const datePrefix = `${day}${month}${year}`

    // Get category code from items
    const categoryCode = await getCategoryCode(this.items)

    // Find the last order with the same date prefix and category code to get the sequence
    const Order = mongoose.model("Order")
    const lastOrder = await Order.findOne({
      orderNumber: { $regex: `^${datePrefix}-${categoryCode}-` },
    }).sort({ createdAt: -1 })

    let sequence = 1
    if (lastOrder && lastOrder.orderNumber) {
      const parts = lastOrder.orderNumber.split("-")
      const lastSequence = parseInt(parts[2]) || 0
      sequence = lastSequence + 1
    }

    this.orderNumber = `${datePrefix}-${categoryCode}-${sequence}`
  }
  next()
})

module.exports = mongoose.model("Order", orderSchema)