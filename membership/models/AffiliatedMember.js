const mongoose = require("mongoose");

const affiliatedMemberSchema = new mongoose.Schema(
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
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
    },
    clubName: {
      type: String,
      required: [true, "Club name is required"],
      trim: true,
    },
    clubLocation: {
      type: String,
      default: "",
    },
    membershipId: {
      type: String,
      default: "",
      trim: true,
    },
    purpose: {
      type: String,
      default: "",
    },
    visitDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

affiliatedMemberSchema.index({ phone: 1 });
affiliatedMemberSchema.index({ clubName: 1 });
affiliatedMemberSchema.index({ visitDate: -1 });

module.exports = mongoose.model("AffiliatedMember", affiliatedMemberSchema);
