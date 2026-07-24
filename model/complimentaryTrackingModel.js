const mongoose = require("mongoose")

const complimentaryTrackingSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: [true, "Branch ID is required"],
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: [true, "Date is required"],
  },
  totalComplimentaryBills: {
    type: Number,
    default: 0,
  },
  totalComplimentaryAmount: {
    type: Number,
    default: 0,
  },
  complimentaryBills: [{
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CounterBill",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CounterOrder",
    },
    customerName: String,
    amount: Number,
    reason: String,
    time: String,
    invoiceNumber: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Compound index to ensure one tracking record per branch per day
complimentaryTrackingSchema.index({ branchId: 1, date: 1 }, { unique: true })

// Update the updatedAt field before saving
complimentaryTrackingSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model("ComplimentaryTracking", complimentaryTrackingSchema)