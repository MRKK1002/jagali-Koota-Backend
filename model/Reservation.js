const mongoose = require("mongoose")

const reservationSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: false, // Make it optional for backward compatibility
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
    },
    guestCount: {
      type: Number,
      required: true,
      min: 1,
    },
    reservationDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["reserved", "confirmed", "completed", "cancelled"],
      default: "reserved",
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model("Reservation", reservationSchema)