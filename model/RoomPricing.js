const mongoose = require('mongoose');

// Dynamic Pricing Model for Rooms
const roomPricingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
  // Base pricing
  basePrice: {
    type: Number,
    required: true,
  },
  // Seasonal pricing
  seasonalPricing: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    priceMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 5.0,
    },
    fixedPrice: {
      type: Number,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  }],
  // Weekend pricing
  weekendPricing: {
    enabled: {
      type: Boolean,
      default: false,
    },
    priceMultiplier: {
      type: Number,
      default: 1.2,
      min: 1.0,
      max: 3.0,
    },
    fixedPrice: {
      type: Number,
      min: 0,
    },
    days: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    }],
  },
  // Early bird discount
  earlyBirdDiscount: {
    enabled: {
      type: Boolean,
      default: false,
    },
    daysInAdvance: {
      type: Number,
      default: 7,
      min: 1,
    },
    discountPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 50,
    },
  },
  // Last minute deals
  lastMinuteDeals: {
    enabled: {
      type: Boolean,
      default: false,
    },
    hoursBeforeCheckIn: {
      type: Number,
      default: 24,
      min: 1,
    },
    discountPercent: {
      type: Number,
      default: 15,
      min: 0,
      max: 50,
    },
  },
  // Length of stay discount
  lengthOfStayDiscount: [{
    minNights: {
      type: Number,
      required: true,
      min: 2,
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    }
  }],
  // Occupancy-based pricing
  occupancyBasedPricing: {
    enabled: {
      type: Boolean,
      default: false,
    },
    tiers: [{
      occupancyPercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      priceMultiplier: {
        type: Number,
        required: true,
        min: 1.0,
        max: 3.0,
      }
    }],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true
});

// Method to calculate price for a specific date range
roomPricingSchema.methods.calculatePrice = function(checkInDate, checkOutDate, bookingDate = new Date()) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  
  let totalPrice = 0;
  let appliedDiscounts = [];
  
  // Calculate price for each night
  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkIn);
    currentDate.setDate(currentDate.getDate() + i);
    
    let nightPrice = this.basePrice;
    let priceBreakdown = { date: currentDate, basePrice: this.basePrice };
    
    // Check seasonal pricing
    const seasonalRate = this.seasonalPricing.find(season => 
      season.isActive && 
      currentDate >= season.startDate && 
      currentDate <= season.endDate
    );
    
    if (seasonalRate) {
      if (seasonalRate.fixedPrice) {
        nightPrice = seasonalRate.fixedPrice;
      } else {
        nightPrice = this.basePrice * seasonalRate.priceMultiplier;
      }
      priceBreakdown.seasonal = { name: seasonalRate.name, price: nightPrice };
    }
    
    // Check weekend pricing
    if (this.weekendPricing.enabled) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
      if (this.weekendPricing.days.includes(dayName)) {
        if (this.weekendPricing.fixedPrice) {
          nightPrice = this.weekendPricing.fixedPrice;
        } else {
          nightPrice = nightPrice * this.weekendPricing.priceMultiplier;
        }
        priceBreakdown.weekend = { day: dayName, price: nightPrice };
      }
    }
    
    priceBreakdown.finalPrice = nightPrice;
    totalPrice += nightPrice;
  }
  
  let discountAmount = 0;
  
  // Apply early bird discount
  if (this.earlyBirdDiscount.enabled) {
    const daysUntilCheckIn = Math.ceil((checkIn - bookingDate) / (1000 * 60 * 60 * 24));
    if (daysUntilCheckIn >= this.earlyBirdDiscount.daysInAdvance) {
      const discount = (totalPrice * this.earlyBirdDiscount.discountPercent) / 100;
      discountAmount += discount;
      appliedDiscounts.push({
        type: 'earlyBird',
        percent: this.earlyBirdDiscount.discountPercent,
        amount: discount
      });
    }
  }
  
  // Apply last minute deals
  if (this.lastMinuteDeals.enabled) {
    const hoursUntilCheckIn = (checkIn - bookingDate) / (1000 * 60 * 60);
    if (hoursUntilCheckIn <= this.lastMinuteDeals.hoursBeforeCheckIn) {
      const discount = (totalPrice * this.lastMinuteDeals.discountPercent) / 100;
      discountAmount += discount;
      appliedDiscounts.push({
        type: 'lastMinute',
        percent: this.lastMinuteDeals.discountPercent,
        amount: discount
      });
    }
  }
  
  // Apply length of stay discount
  const losDiscount = this.lengthOfStayDiscount
    .filter(d => d.isActive && nights >= d.minNights)
    .sort((a, b) => b.discountPercent - a.discountPercent)[0];
  
  if (losDiscount) {
    const discount = (totalPrice * losDiscount.discountPercent) / 100;
    discountAmount += discount;
    appliedDiscounts.push({
      type: 'lengthOfStay',
      nights: nights,
      percent: losDiscount.discountPercent,
      amount: discount
    });
  }
  
  const finalPrice = totalPrice - discountAmount;
  
  return {
    basePrice: this.basePrice,
    nights: nights,
    totalBeforeDiscount: totalPrice,
    discounts: appliedDiscounts,
    totalDiscount: discountAmount,
    finalPrice: finalPrice,
    pricePerNight: finalPrice / nights
  };
};

module.exports = mongoose.model('RoomPricing', roomPricingSchema);