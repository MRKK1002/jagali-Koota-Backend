const mongoose = require("mongoose")

/**
 * NonChargeableTracking — per branch, per business day rollup of non-chargeable
 * bills (internal consumption: staff meals, management, tasting, wastage).
 *
 * Mirrors ComplimentaryTracking, but kept as a separate collection because the
 * two are accounted differently: complimentary is customer-facing goodwill
 * (marketing), non-chargeable is internal consumption (staff welfare / wastage).
 * Month-end reporting needs them as distinct figures.
 */
const nonChargeableTrackingSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: [true, "Branch ID is required"],
  },
  date: {
    type: String,
    required: [true, "Date is required"],
  },
  totalNonChargeableBills: {
    type: Number,
    default: 0,
  },
  totalNonChargeableAmount: {
    type: Number,
    default: 0,
  },

  byType: {
    staff: { type: Number, default: 0 },
    management: { type: Number, default: 0 },
    tasting: { type: Number, default: 0 },
    wastage: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  nonChargeableBills: [
    {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CounterOrder",
      },
      invoiceNumber: String,
      customerName: String,
      tableNumber: String,
      amount: Number,
      // Must be written as { type: String }, not `type: String`. A bare `type`
      // key makes Mongoose read the whole subdocument as a type definition,
      // collapsing this array to [String] and failing every insert.
      type: { type: String },
      reason: String,
      approvedBy: String,
      time: String,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// One tracking record per branch per business day
nonChargeableTrackingSchema.index({ branchId: 1, date: 1 }, { unique: true })

nonChargeableTrackingSchema.pre("save", function (next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model("NonChargeableTracking", nonChargeableTrackingSchema)
