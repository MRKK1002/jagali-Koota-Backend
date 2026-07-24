const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  vendorId: String,
  materialId: String,
  quotedPrice: Number,
  deliveryTerms: String,
  validity: Date,
});

module.exports = mongoose.model('Quotation', QuotationSchema);