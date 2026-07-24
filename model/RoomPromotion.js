const mongoose = require('mongoose');

// Promotions and Packages Model
const roomPromotionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  promotionType: {
    type: String,
    required: true,
    enum: ['coupon', 'package', 'loyalty', 'referral', 'seasonal', 'corporate'],
    default: 'coupon',
  },
  // Coupon details
  couponCode: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
    unique: true,
  },
  // Discount details
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'freeNight', 'upgrade'],
    default: 'percentage',
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  maxDiscountAmount: {
    type: Number,
    default: null,
  },
  minBookingAmount: {
    type: Number,
    default: 0,
  },
  // Validity
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  // Usage limits
  maxUsageTotal: {
    type: Number,
    default: null, // null = unlimited
  },
  maxUsagePerUser: {
    type: Number,
    default: 1,
  },
  currentUsageCount: {
    type: Number,
    default: 0,
  },
  // Applicable to
  applicableRoomTypes: [{
    type: String,
    enum: ['Single', 'Double', 'Suite', 'Deluxe', 'Family', 'Presidential', 'All'],
  }],
  applicableBranches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
  }],
  // Package details (if promotionType is 'package')
  packageInclusions: [{
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    value: {
      type: Number,
      default: 0,
    }
  }],
  // Terms and conditions
  termsAndConditions: {
    type: String,
    trim: true,
  },
  // Blackout dates (dates when promotion cannot be used)
  blackoutDates: [{
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    }
  }],
  // Status
  isActive: {
    type: Boolean,
    default: true,
  },
  // Tracking
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomBooking',
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
    discountApplied: {
      type: Number,
    }
  }],
  // Display settings
  displayOnWebsite: {
    type: Boolean,
    default: true,
  },
  displayOnApp: {
    type: Boolean,
    default: true,
  },
  bannerImage: {
    type: String,
    trim: true,
  },
  priority: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true
});

// Index for efficient queries
roomPromotionSchema.index({ couponCode: 1 });
roomPromotionSchema.index({ promotionType: 1 });
roomPromotionSchema.index({ isActive: 1 });
roomPromotionSchema.index({ startDate: 1, endDate: 1 });

// Method to validate if promotion is applicable
roomPromotionSchema.methods.isValid = function(checkInDate, checkOutDate, roomType, branchId, userId) {
  const now = new Date();
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  
  // Check if promotion is active
  if (!this.isActive) {
    return { valid: false, reason: 'Promotion is not active' };
  }
  
  // Check validity dates
  if (now < this.startDate || now > this.endDate) {
    return { valid: false, reason: 'Promotion has expired or not yet started' };
  }
  
  // Check usage limits
  if (this.maxUsageTotal && this.currentUsageCount >= this.maxUsageTotal) {
    return { valid: false, reason: 'Promotion usage limit reached' };
  }
  
  // Check per-user usage limit
  if (userId) {
    const userUsageCount = this.usedBy.filter(u => u.userId && u.userId.toString() === userId.toString()).length;
    if (userUsageCount >= this.maxUsagePerUser) {
      return { valid: false, reason: 'You have already used this promotion maximum times' };
    }
  }
  
  // Check room type applicability
  if (this.applicableRoomTypes.length > 0 && 
      !this.applicableRoomTypes.includes('All') && 
      !this.applicableRoomTypes.includes(roomType)) {
    return { valid: false, reason: 'Promotion not applicable to this room type' };
  }
  
  // Check branch applicability
  if (this.applicableBranches.length > 0 && 
      !this.applicableBranches.some(b => b.toString() === branchId.toString())) {
    return { valid: false, reason: 'Promotion not applicable to this branch' };
  }
  
  // Check blackout dates
  for (const blackout of this.blackoutDates) {
    if ((checkIn >= blackout.startDate && checkIn <= blackout.endDate) ||
        (checkOut >= blackout.startDate && checkOut <= blackout.endDate) ||
        (checkIn <= blackout.startDate && checkOut >= blackout.endDate)) {
      return { valid: false, reason: 'Promotion not available for selected dates (blackout period)' };
    }
  }
  
  return { valid: true };
};

// Method to calculate discount
roomPromotionSchema.methods.calculateDiscount = function(bookingAmount) {
  if (bookingAmount < this.minBookingAmount) {
    return { discount: 0, reason: `Minimum booking amount is ₹${this.minBookingAmount}` };
  }
  
  let discount = 0;
  
  switch (this.discountType) {
    case 'percentage':
      discount = (bookingAmount * this.discountValue) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
      }
      break;
    case 'fixed':
      discount = this.discountValue;
      break;
    case 'freeNight':
      // This would need to be calculated based on room price
      discount = 0; // Handled separately in booking logic
      break;
    case 'upgrade':
      // This would need to be handled in booking logic
      discount = 0;
      break;
  }
  
  return { discount: discount, discountType: this.discountType };
};

// Method to mark as used
roomPromotionSchema.methods.markAsUsed = function(userId, bookingId, discountApplied) {
  this.usedBy.push({
    userId: userId,
    bookingId: bookingId,
    usedAt: new Date(),
    discountApplied: discountApplied
  });
  this.currentUsageCount += 1;
  return this.save();
};

module.exports = mongoose.model('RoomPromotion', roomPromotionSchema);