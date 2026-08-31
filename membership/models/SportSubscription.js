const mongoose = require("mongoose");

const sportSubscriptionSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: [true, "Member is required"],
    },
    sportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sport",
      required: [true, "Sport is required"],
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["wallet", "cash", "card", "upi"],
      default: "wallet",
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

sportSubscriptionSchema.index({ memberId: 1, status: 1 });
sportSubscriptionSchema.index({ sportId: 1, status: 1 });
sportSubscriptionSchema.index({ endDate: 1 });
sportSubscriptionSchema.index({ memberId: 1, sportId: 1, status: 1 });

module.exports = mongoose.model("SportSubscription", sportSubscriptionSchema);
