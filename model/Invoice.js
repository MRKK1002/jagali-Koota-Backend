const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  poId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  amount: Number,
  dueDate: Date,
  paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
});

module.exports = mongoose.model('Invoice', InvoiceSchema);