const mongoose = require("mongoose");

const sportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sport name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: null,
    },
    priceMonthly: {
      type: Number,
      required: [true, "Monthly price is required"],
      min: 0,
    },
    priceYearly: {
      type: Number,
      default: 0,
      min: 0,
    },
    schedule: {
      type: String,
      default: "",
      // e.g. "Mon, Wed, Fri — 6:00 PM to 7:30 PM"
    },
    maxMembers: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    currentMembers: {
      type: Number,
      default: 0,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

sportSchema.index({ isActive: 1 });
sportSchema.index({ name: 1 });
sportSchema.index({ branchId: 1 });

module.exports = mongoose.model("Sport", sportSchema);
