const mongoose = require('mongoose');

const subscriptionOrderSchema = new mongoose.Schema({
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
  planType: {
    type: String,
    enum: ["daily", "weekly", "monthly", "yearly"],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  nextDeliveryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["active", "paused", "cancelled", "completed"],
    default: "active"
  },
  totalCycles: {
    type: Number,
    default: null // null means unlimited
  },
  completedCycles: {
    type: Number,
    default: 0
  },
  deliveryAddress: {
    type: String,
    required: true
  },
  deliveryInstructions: {
    type: String,
    default: ''
  },
  deliveryDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  deliveryTime: {
    type: String,
    default: '09:00'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'wallet'],
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
  cancellationReason: {
    type: String,
    default: null
  },
  cancellationDate: {
    type: Date,
    default: null
  },
  subscriptionHistory: [{
    action: {
      type: String,
      enum: ['created', 'paused', 'resumed', 'cancelled', 'delivered', 'cycle_completed']
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: String,
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    }
  }],
  deliveryTracking: [{
    scheduledDate: {
      type: Date,
      required: true
    },
    actualDeliveryDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ["scheduled", "out_for_delivery", "delivered", "failed", "rescheduled"],
      default: "scheduled"
    },
    deliveryPerson: {
      name: String,
      phone: String,
      id: String
    },
    deliveryNotes: String,
    customerSignature: String,
    photos: [String], // Array of photo URLs
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    feedback: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Next delivery date is calculated in the controller

// Index for better query performance
subscriptionOrderSchema.index({ userId: 1, status: 1 });
subscriptionOrderSchema.index({ productId: 1, branchId: 1 });
subscriptionOrderSchema.index({ nextDeliveryDate: 1, status: 1 });
subscriptionOrderSchema.index({ status: 1, nextDeliveryDate: 1 });

module.exports = mongoose.model('SubscriptionOrder', subscriptionOrderSchema);