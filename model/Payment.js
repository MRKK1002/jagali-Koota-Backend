const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true },
  vendorId: String,
  amount: Number,
  paymentMode: { type: String, enum: ['NEFT', 'Cheque', 'UPI'] },
  paymentDate: Date,
  remarks: String,
});

module.exports = mongoose.model('Payment', PaymentSchema);