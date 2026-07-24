const mongoose = require('mongoose');

const mealOfTheDaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu',
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  originalPrice: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  specialPrice: {
    type: Number,
    required: true,
    min: [0, 'Special price cannot be negative']
  },
  discount: {
    type: Number,
    required: true,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  image: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  availableQuantity: {
    type: Number,
    required: true,
    min: [0, 'Available quantity cannot be negative']
  },
  soldQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Sold quantity cannot be negative']
  },
  tags: [{
    type: String,
    trim: true
  }],
  preparationTime: {
    type: Number, // in minutes
    default: null
  },
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number
  },
  allergens: [{
    type: String,
    trim: true
  }],
  featured: {
    type: Boolean,
    default: false
  },
  adminNotes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for better query performance
mealOfTheDaySchema.index({ date: 1, branchId: 1 });
mealOfTheDaySchema.index({ branchId: 1, isActive: 1 });
mealOfTheDaySchema.index({ date: 1, isActive: 1 });

// Compound unique index to prevent duplicate meals for same date and branch
mealOfTheDaySchema.index({ date: 1, branchId: 1 }, { unique: true });

// Virtual for remaining quantity
mealOfTheDaySchema.virtual('remainingQuantity').get(function() {
  return this.availableQuantity - this.soldQuantity;
});

// Ensure virtual fields are serialized
mealOfTheDaySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('MealOfTheDay', mealOfTheDaySchema);