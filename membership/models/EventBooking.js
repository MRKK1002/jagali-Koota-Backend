const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    age:  { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const eventBookingSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    memberName: {
      type: String,
      required: true,
    },
    memberEmail: {
      type: String,
      required: true,
    },
    memberPhone: {
      type: String,
      default: "",
    },
    numberOfPeople: {
      type: Number,
      required: true,
      min: 1,
    },
    guests: {
      type: [guestSchema],
      default: [],
    },
    pricePerPerson: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled", "attended", "no-show"],
      default: "confirmed",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["wallet", "cash", "card", "upi", "other"],
      default: "other",
    },
    walletDeducted: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: "",
    },
    adminNotes: {
      type: String,
      default: "",
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eventBookingSchema.index({ eventId: 1 });
eventBookingSchema.index({ memberId: 1 });
eventBookingSchema.index({ status: 1 });
eventBookingSchema.index({ createdAt: -1 });

const EventBooking = mongoose.model("EventBooking", eventBookingSchema);

module.exports = EventBooking;
