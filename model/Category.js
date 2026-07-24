const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
  },
  image: {
    type: String,
    default: null
  },
  // Support both formats for backward compatibility
  branchId: {
    type: String, // Changed from ObjectId to String to match crm_backend
    required: false // Made optional since we also have branch object
  },
  branch: {
    id: {
      type: String,
      required: [true, 'Branch ID is required']
    },
    name: {
      type: String,
      required: [true, 'Branch name is required']
    },
    address: {
      type: String,
      required: [true, 'Branch address is required']
    }
  },
  loginPassword: {
    type: String,
    default: null
  },
  cancelOrderPassword: {
    type: String,
    default: null
  },
  gstRate: {
    type: Number,
    default: 0,
    min: [0, 'GST rate cannot be negative'],
    max: [100, 'GST rate cannot exceed 100%']
  }
}, {
  timestamps: true
});

// Create a compound index on name and branch.id
// This allows the same category name across different branches
categorySchema.index({ name: 1, 'branch.id': 1 }, { unique: true });

module.exports = mongoose.model('Categoryy', categorySchema);