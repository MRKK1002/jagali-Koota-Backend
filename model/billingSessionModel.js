const mongoose = require("mongoose")

/**
 * BillingSession — one document per branch per business day.
 *
 * Represents the "day open / day close" state of a billing counter, and the
 * immutable Z-Report snapshot captured at close time.
 *
 * Lifecycle:
 *   1. Auto-created as 'open' when the first bill of the day is generated.
 *   2. Cashier settles every bill (paymentStatus: billed -> completed).
 *   3. Cashier closes billing: system validates nothing is pending, captures
 *      totals + payment breakdown + declared cash, and freezes the record.
 *   4. Once 'closed', no new bill can be created for that branch+date.
 */
const billingSessionSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    branchName: {
      type: String,
      default: null,
    },
    // Business day in YYYY-MM-DD (local). One session per branch per day.
    date: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },

    openedAt: {
      type: Date,
      default: Date.now,
    },
    openedBy: {
      type: String,
      trim: true,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Z-Report snapshot (frozen at close time) ──────────────────────────
    totals: {
      billCount: { type: Number, default: 0 },
      grossSales: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
    },

    // Money collected per payment mode, derived from settled bills
    paymentBreakdown: {
      cash: { type: Number, default: 0 },
      upi: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
    },

    // Give-aways, frozen at close. Kept apart from sales and from each other:
    // complimentary = customer goodwill, nonChargeable = internal consumption.
    giveaways: {
      complimentary: {
        count: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
      },
      nonChargeable: {
        count: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
        byType: {
          staff: { type: Number, default: 0 },
          management: { type: Number, default: 0 },
          tasting: { type: Number, default: 0 },
          wastage: { type: Number, default: 0 },
          other: { type: Number, default: 0 },
        },
      },
    },

    // Cash reconciliation — cashier physically counts the drawer
    cashExpected: { type: Number, default: 0 },
    cashDeclared: { type: Number, default: 0 },
    // Positive = excess in drawer, negative = short
    cashVariance: { type: Number, default: 0 },

    notes: {
      type: String,
      trim: true,
      default: null,
    },

    // Audit trail for reopen events
    reopenHistory: [
      {
        reopenedAt: { type: Date },
        reopenedBy: { type: String, trim: true },
        reason: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
)

// One session per branch per business day
billingSessionSchema.index({ branchId: 1, date: 1 }, { unique: true })
billingSessionSchema.index({ status: 1 })
billingSessionSchema.index({ date: -1 })

module.exports = mongoose.model("BillingSession", billingSessionSchema)
