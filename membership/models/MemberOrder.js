const mongoose = require("mongoose");

const memberOrderSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Member ID is required"],
      index: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    items: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item", // Assuming you have an Item model
        },
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Generate order number
memberOrderSchema.pre("save", async function (next) {
  try {
    if (this.isNew && !this.orderNumber) {
      const count = await this.constructor.countDocuments();
      this.orderNumber = `ORD${String(count + 1).padStart(6, "0")}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Index for efficient queries
memberOrderSchema.index({ memberId: 1, createdAt: -1 });
memberOrderSchema.index({ status: 1, createdAt: -1 });

const MemberOrder = mongoose.model("MemberOrder", memberOrderSchema);

module.exports = MemberOrder;
