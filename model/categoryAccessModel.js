const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const categoryAccessSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [4, 'Password must be at least 4 characters'],
  },
  cancelPassword: {
    type: String,
    required: [true, 'Cancel password is required'],
    minlength: [4, 'Cancel password must be at least 4 characters'],
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  categoryName: {
    type: String,
    required: true,
  },
  branchId: {
    type: String,  // Store as string since it might come from different sources
  },
  branchName: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Hash password before saving
categoryAccessSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
categoryAccessSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('CategoryAccess', categoryAccessSchema);