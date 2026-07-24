const mongoose = require('mongoose');

// Bill Counter Schema for managing sequential bill numbers per category
const billCounterSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Restaurant', 'Self Service', 'Temple Meals'],
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
  },
  lastBillNumber: {
    type: Number,
    default: 0,
  },
  lastInvoiceNumber: {
    type: Number,
    default: 0, // Keep in sync with lastBillNumber
  },
  lastKOTNumber: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure one counter per branch per category per day
billCounterSchema.index({ branchId: 1, category: 1, date: 1 }, { unique: true });

// Update the updatedAt field before saving
billCounterSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('BillCounter', billCounterSchema);