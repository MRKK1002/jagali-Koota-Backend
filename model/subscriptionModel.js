const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  subscriptionType: {
    type: String,
    enum: ['weekly', 'monthly', 'yearly'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'expired'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  nextDeliveryDate: {
    type: Date,
    required: true
  },
  pauseStartDate: {
    type: Date,
    default: null
  },
  pauseEndDate: {
    type: Date,
    default: null
  },
  pauseReason: {
    type: String,
    default: null
  },
  deliveryAddress: {
    type: String,
    required: true
  },
  deliveryInstructions: {
    type: String,
    default: ''
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'wallet'],
    required: true
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  deliveryDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  deliveryTime: {
    type: String,
    default: '09:00'
  },
  subscriptionHistory: [{
    action: {
      type: String,
      enum: ['created', 'paused', 'resumed', 'cancelled', 'renewed', 'delivered']
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Calculate end date based on subscription type
subscriptionSchema.pre('save', function(next) {
  if (this.isNew) {
    const startDate = new Date(this.startDate);
    let endDate = new Date(startDate);
    
    switch (this.subscriptionType) {
      case 'weekly':
        endDate.setDate(startDate.getDate() + 7);
        break;
      case 'monthly':
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      case 'yearly':
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
    }
    
    this.endDate = endDate;
    this.nextDeliveryDate = new Date(startDate);
  }
  next();
});

// Index for better query performance
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ productId: 1, branchId: 1 });
subscriptionSchema.index({ nextDeliveryDate: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);







