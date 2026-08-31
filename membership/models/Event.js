const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
    },
    images: {
      type: [String],
      default: [],
    },
    eventDate: {
      type: Date,
      required: [true, "Event date is required"],
    },
    eventTime: {
      type: String,
      required: [true, "Event time is required"],
    },
    location: {
      type: String,
      default: "",
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
    isPinned: {
      type: Boolean,
      default: false,
    },
    // Booking/Reservation fields
    bookingEnabled: {
      type: Boolean,
      default: false,
    },
    pricePerPerson: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxBookings: {
      type: Number,
      default: null, // null means unlimited
    },
    totalBooked: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: false, // Optional for now until admin auth is implemented
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
eventSchema.index({ isActive: 1, eventDate: -1 });
eventSchema.index({ isPinned: -1, eventDate: -1 });

// Virtual to check if event is upcoming
eventSchema.virtual("isUpcoming").get(function () {
  return new Date(this.eventDate) > new Date();
});

// Virtual to check if event is past
eventSchema.virtual("isPast").get(function () {
  return new Date(this.eventDate) < new Date();
});

// Virtual to check if booking is available
eventSchema.virtual("bookingAvailable").get(function () {
  if (!this.bookingEnabled) return false;
  if (!this.maxBookings) return true; // unlimited
  return this.totalBooked < this.maxBookings;
});

// Virtual for remaining seats
eventSchema.virtual("remainingSeats").get(function () {
  if (!this.bookingEnabled) return 0;
  if (!this.maxBookings) return null; // unlimited
  return Math.max(0, this.maxBookings - this.totalBooked);
});

// Ensure virtuals are included in JSON
eventSchema.set("toJSON", { virtuals: true });
eventSchema.set("toObject", { virtuals: true });

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
