const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  email: { type: String },
  dob: { type: String },
  anniversary: { type: String },
  preferences: { type: String },
  feedback: { type: String },
  rating: { type: Number, default: 5 },
  loyaltyPoints: { type: Number, default: 0 },
  lastVisit: { type: String },
  totalVisits: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);