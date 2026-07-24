const mongoose = require('mongoose');

const RFSchema = new mongoose.Schema({
  rfqId: { type: String, required: true, unique: true },
  materials: [{ name: String, quantity: Number }],
  requestedBy: String,
  vendorIds: [String],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RFQ', RFSchema);