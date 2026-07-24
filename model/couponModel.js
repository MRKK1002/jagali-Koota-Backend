const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Coupon description is required"],
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount cannot be negative"],
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageLimit: {
      type: Number,
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    applicableBranches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
      },
    ],
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Categoryy", 
      },
    ],
    applicableMenuItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Menu",
      },
    ],
    oneTimePerUser: {
      type: Boolean,
      default: false,
    },
    usedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    image: {
      type: String,
      default: null, 
    },
  },
  {
    timestamps: true,
  }
);


couponSchema.methods.isValid = function (orderValue, userId, branchId) {
  const now = new Date();

  if (!this.isActive) {
    return { valid: false, message: "Coupon is inactive" };
  }

  // Fix expiry check: Compare with end of day instead of start of day
  const endOfDay = new Date(this.endDate);
  endOfDay.setHours(23, 59, 59, 999); // Set to end of day (11:59:59 PM)

  if (now > endOfDay) {
    return { valid: false, message: "Coupon has expired" };
  }

  if (now < this.startDate) {
    return { valid: false, message: "Coupon is not yet active" };
  }

  if (orderValue < this.minOrderValue) {
    return {
      valid: false,
      message: `Minimum order value of ₹${this.minOrderValue} required`,
    };
  }

  if (this.usageLimit !== null && this.usageCount >= this.usageLimit) {
    return { valid: false, message: "Coupon usage limit reached" };
  }

  if (this.oneTimePerUser && userId) {
    const userHasUsed = this.usedBy.some(
      (usage) => usage.userId.toString() === userId.toString()
    );
    if (userHasUsed) {
      return { valid: false, message: "You have already used this coupon" };
    }
  }

  if (this.applicableBranches.length > 0 && branchId) {
    const branchApplicable = this.applicableBranches.some(
      (branch) => branch.toString() === branchId.toString()
    );
    if (!branchApplicable) {
      return { valid: false, message: "Coupon not applicable to this branch" };
    }
  }

  let discountAmount = 0;
  if (this.discountType === "percentage") {
    discountAmount = (orderValue * this.discountValue) / 100;
    if (this.maxDiscountAmount && discountAmount > this.maxDiscountAmount) {
      discountAmount = this.maxDiscountAmount;
    }
  } else {
    discountAmount = this.discountValue;
    if (discountAmount > orderValue) {
      discountAmount = orderValue;
    }
  }

  return {
    valid: true,
    discountAmount,
    discountType: this.discountType,
    discountValue: this.discountValue,
    message: "Coupon applied successfully",
  };
};

module.exports = mongoose.model("Coupon", couponSchema);