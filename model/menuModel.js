const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  // Support both name and itemName for backward compatibility
  name: {
    type: String,
    trim: true
  },
  itemName: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Price field
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  // GST Rate (percentage)
  gstRate: {
    type: Number,
    default: 0,
    min: [0, 'GST rate cannot be negative'],
    max: [100, 'GST rate cannot exceed 100%']
  },
  // Food type for filtering. Not schema-required so legacy items stay editable.
  foodType: {
    type: String,
    enum: ['veg', 'non-veg', 'egg', 'sea-food', 'chef-special', 'spice-level', 'gluten-free'],
    default: null
  },
  // Old structure kept for backward compatibility
  quantities: {
    type: [String],
    default: []
  },
  prices: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  gstRates: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  menuTypes: {
    type: [String],
    default: []
  },
  image: {
    type: String,
    default: null
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoryy',
    required: [true, 'Category ID is required']
  },
  subcategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subcategory',
    default: null
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch ID is required']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
  lowStockAlert: {
    type: Number,
    default: 5,
    min: [0, 'Low stock alert cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  subscriptionPlans: [{
    type: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Subscription price cannot be negative']
    },
    duration: {
      type: Number,
      default: null // Optional duration in cycles (e.g., 3 months = 3)
    },
    isActive: {
      type: Boolean,
      default: true
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    }
  }],
  subscriptionEnabled: {
    type: Boolean,
    default: false
  },
  subscriptionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Subscription amount cannot be negative']
  },
  subscriptionDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Subscription discount cannot be negative'],
    max: [100, 'Subscription discount cannot exceed 100%']
  },
  subscriptionDuration: {
    type: String,
    enum: ['3days', '1week', '1month', '30days'], // include old value for backward compatibility
    default: '3days'
  },
  subscription3Days: {
    type: Number,
    default: 0,
    min: [0, 'Subscription price cannot be negative']
  },
  subscription1Week: {
    type: Number,
    default: 0,
    min: [0, 'Subscription price cannot be negative']
  },
  subscription1Month: {
    type: Number,
    default: 0,
    min: [0, 'Subscription price cannot be negative']
  },
  subscription3DaysDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Subscription discount cannot be negative'],
    max: [100, 'Subscription discount cannot exceed 100%']
  },
  subscription1WeekDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Subscription discount cannot be negative'],
    max: [100, 'Subscription discount cannot exceed 100%']
  },
  subscription1MonthDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Subscription discount cannot be negative'],
    max: [100, 'Subscription discount cannot exceed 100%']
  },
  // Subscription plan fees (what user pays to buy the subscription)
  subscription3DaysPrice: {
    type: Number,
    default: 0,
    min: [0, 'Subscription price cannot be negative']
  },
  subscription1WeekPrice: {
    type: Number,
    default: 0,
    min: [0, 'Subscription price cannot be negative']
  },
  subscription1MonthPrice: {
    type: Number,
    default: 0,
    min: [0, 'Subscription price cannot be negative']
  },
  // Keep old field for backward compatibility
  subscription30Days: {
    type: Number,
    default: 0,
    min: [0, 'Subscription price cannot be negative']
  },
  
  // Membership Discount Fields
  membershipDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Membership discount cannot be negative'],
    max: [100, 'Membership discount cannot exceed 100%']
  },
  discountByTier: {
    Gold: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    },
    Silver: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    },
    Platinum: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    },
    Basic: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    }
  },

  // Temporary disable — item hidden from billing + public menu until this time.
  // Null = active. Set to business-day-end to disable "for today".
  disabledUntil: {
    type: Date,
    default: null,
  },

}, {
  timestamps: true
});

// Add indexes for better query performance
menuSchema.index({ name: 1 });
menuSchema.index({ itemName: 1 });
menuSchema.index({ categoryId: 1 });
menuSchema.index({ branchId: 1 });
menuSchema.index({ isActive: 1 });
menuSchema.index({ createdAt: -1 });
menuSchema.index({ name: 'text', itemName: 'text', description: 'text' }); // Text search index

module.exports = mongoose.model('Menu', menuSchema);