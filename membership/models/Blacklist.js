const mongoose = require("mongoose");

const blacklistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      required: [true, "Reason for blacklisting is required"],
      trim: true,
    },
    blacklistedBy: {
      type: String,
      default: "Admin",
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast search by name or phone
blacklistSchema.index({ name: "text" });

const Blacklist = mongoose.model("Blacklist", blacklistSchema);

module.exports = Blacklist;
