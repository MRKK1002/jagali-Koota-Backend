const mongoose = require("mongoose");

const SiteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    manager: {
      type: String,
      required: true,
    },
    budget: {
      type: String,
      required: true,
    },
    workers: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["Active", "Planning", "Completed"],
      default: "Active",
    },
    startDate: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Site", SiteSchema);