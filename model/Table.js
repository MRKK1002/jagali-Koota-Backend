const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoryy',
    required: false, // Optional for backward compatibility
  },
  number: {
    type: String, // Changed from Number to String to support alphanumeric (A1, B2, VIP1)
    required: true,
    trim: true,
  },
  capacity: {
    type: Number, // Number of people that can sit at this table
    required: false,
    min: 1,
    max: 50, // Reasonable maximum
  },
  status: {
    type: String,
    enum: ['available', 'reserved', 'occupied'], // Added 'occupied' for table shift functionality
    default: 'available',
    required: true,
  },
  image: {
    type: String,
    required: false,
    trim: true,
  },
  qrCode: {
    type: String, // Store QR code data URL or path
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure unique table numbers per branch and category
tableSchema.index({ branchId: 1, categoryId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model('Table', tableSchema);