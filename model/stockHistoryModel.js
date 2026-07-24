const mongoose = require('mongoose');

const stockHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu',
    required: [true, 'Product ID is required']
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: [true, 'Branch ID is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Updated by is required']
  },
  oldStock: {
    type: Number,
    required: [true, 'Old stock is required']
  },
  newStock: {
    type: Number,
    required: [true, 'New stock is required']
  },
  changeType: {
    type: String,
    enum: ['manual', 'order_placed', 'order_cancelled', 'bulk_update'],
    required: [true, 'Change type is required']
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required']
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('StockHistory', stockHistorySchema);
