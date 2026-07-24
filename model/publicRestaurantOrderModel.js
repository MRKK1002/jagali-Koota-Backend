const mongoose = require('mongoose');

const publicRestaurantOrderSchema = new mongoose.Schema({
  // Order identification
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Customer information
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerMobile: {
    type: String,
    required: true,
    trim: true
  },
  peopleCount: {
    type: Number,
    required: true,
    default: 1
  },
  
  // Session tracking (links multiple orders from same table visit)
  sessionId: {
    type: String,
    index: true
  },
  
  // Branch and table information
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  branchName: {
    type: String,
    required: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  tableNumber: {
    type: String,
    required: true
  },
  
  // Category information
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  categoryName: {
    type: String
  },
  
  // Order items
  items: [{
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu'
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    image: String,
    description: String,
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    }
  }],
  
  // Pricing (no tax, no service charge - only item prices)
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Payment information
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'pending'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  
  // Order status
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // Additional information
  notes: String,
  isGuestOrder: {
    type: Boolean,
    default: true
  },
  
  // Timestamps
  orderTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
publicRestaurantOrderSchema.index({ branchId: 1, orderTime: -1 });
publicRestaurantOrderSchema.index({ orderId: 1 });
publicRestaurantOrderSchema.index({ customerMobile: 1 });
publicRestaurantOrderSchema.index({ tableNumber: 1, branchId: 1 });
publicRestaurantOrderSchema.index({ sessionId: 1 }); // Index for session queries

const PublicRestaurantOrder = mongoose.model('PublicRestaurantOrder', publicRestaurantOrderSchema);

module.exports = PublicRestaurantOrder;