const mongoose = require('mongoose');

const roomBookingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    // required: true,
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    // required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  userName: {
    type: String,
    trim: true,
  },
  userPhone: {
    type: String,
    trim: true,
  },
  userEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  guestName: {
    type: String,
    // required: true,
    trim: true,
  },
  guestEmail: {
    type: String,
    required: false, // Made optional
    trim: true,
    lowercase: true,
  },
  guestPhone: {
    type: String,
    // required: true,
    trim: true,
  },
  guestGstNumber: {
    type: String,
    trim: true,
    default: '',
  },
  aadhaarNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return !v || /^\d{12}$/.test(v); // 12 digits if provided
      },
      message: 'Aadhaar number must be 12 digits'
    }
  },
  panNumber: {
    type: String,
    trim: true,
    uppercase: true,
    validate: {
      validator: function (v) {
        return !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v); // PAN format if provided
      },
      message: 'Invalid PAN number format'
    }
  },
  aadhaarPic: {
    type: String, // Store file path or URL
    trim: true,
    default: null,
  },
  visaPic: {
    type: String, // Store file path or URL
    trim: true,
    default: null,
  },
  isExceeding24Hours: {
    type: Boolean,
    default: false,
  },
  customAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  checkInDate: {
    type: Date,
    required: true,
  },
  checkOutDate: {
    type: Date,
    required: true,
  },
  checkInTime: {
    type: String,
    required: true,
    default: '12:00',
  },
  checkOutTime: {
    type: String,
    required: true,
    default: '11:00',
  },
  actualCheckInTime: {
    type: Date,
    default: null,
  },
  actualCheckOutTime: {
    type: Date,
    default: null,
  },
  restaurantBills: [{
    date: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    addedBy: {
      type: String,
      default: 'Receptionist',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    }
  }],
  restaurantTotal: {
    type: Number,
    default: 0,
  },
  nights: {
    type: Number,
    default: 1,
  },
  adults: {
    type: Number,
    min: 1,
    default: 1,
  },
  children: {
    type: Number,
    default: 0,
    min: 0,
  },
  baseAmount: {
    type: Number,
    required: true,
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  gstOption: {
    type: String,
    enum: ['withoutGST', 'withGST', 'withIGST'],
    default: 'withGST',
  },
  gstType: {
    type: String,
    enum: ['none', 'gst', 'igst'], // none = without GST, gst = CGST+SGST (within state), igst = IGST (out of state)
    default: 'none',
  },
  gstAmount: {
    type: Number,
    default: 0,
  },
  cgst: {
    type: Number,
    default: 0,
    min: 0,
  },
  sgst: {
    type: Number,
    default: 0,
    min: 0,
  },
  igst: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0,
  },
  cashAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  onlineAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'cancel-requested', 'completed'],
    default: 'confirmed',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'refunded'],
    default: 'pending',
  },
  specialRequests: {
    type: String,
    trim: true,
  },
  bookingSource: {
    type: String,
    enum: ['online', 'walk-in', 'phone', 'app'],
    default: 'online',
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    trim: true,
  },
  payments: [{
    amount: { 
      type: Number, 
      required: true 
    },
    method: { 
      type: String, 
      enum: ['cash', 'online'], 
      required: true 
    },
    date: { 
      type: Date, 
      default: Date.now 
    },
    note: { 
      type: String 
    }
  }],
  cancellationReason: {
    type: String,
  },
  refundAmount: {
    type: Number,
    default: 0,
  },
  cancellationCharges: {
    type: Number,
    default: 0,
  },
  extensions: [{
    previousCheckOutDate: {
      type: Date,
      required: true,
    },
    newCheckOutDate: {
      type: Date,
      required: true,
    },
    additionalNights: {
      type: Number,
      required: true,
      min: 1,
    },
    additionalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    extendedAt: {
      type: Date,
      default: Date.now,
    }
  }],
}, {
  timestamps: true
});

// Index for efficient queries
roomBookingSchema.index({ roomId: 1, checkInDate: 1, checkOutDate: 1 });
roomBookingSchema.index({ branchId: 1 });
roomBookingSchema.index({ userId: 1 });
roomBookingSchema.index({ guestEmail: 1 });
roomBookingSchema.index({ guestPhone: 1 });
roomBookingSchema.index({ status: 1 });
roomBookingSchema.index({ paymentStatus: 1 });
roomBookingSchema.index({ bookingDate: -1 });
roomBookingSchema.index({ checkInDate: 1 });
roomBookingSchema.index({ checkOutDate: 1 });
roomBookingSchema.index({ gstType: 1 });
roomBookingSchema.index({ 'extensions.extendedAt': -1 });

// Virtual for remaining balance
roomBookingSchema.virtual('remainingBalance').get(function () {
  return this.totalAmount - this.amountPaid;
});

// Virtual for grand total (room + restaurant)
roomBookingSchema.virtual('grandTotal').get(function() {
  return this.totalAmount + this.restaurantTotal;
});

// Virtual for remaining grand total balance
roomBookingSchema.virtual('remainingGrandBalance').get(function() {
  return (this.totalAmount + this.restaurantTotal) - this.amountPaid;
});

// Method to add payment
roomBookingSchema.methods.addPayment = function (paymentData) {
  this.payments.push(paymentData);
  this.amountPaid += paymentData.amount;
  
  if (paymentData.method === 'cash') {
    this.cashAmount += paymentData.amount;
  } else {
    this.onlineAmount += paymentData.amount;
  }
  
  // Update payment status
  if (this.amountPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else if (this.amountPaid > 0) {
    this.paymentStatus = 'partial';
  }
  
  return this.save();
};

// Method to calculate GST amounts
roomBookingSchema.methods.calculateGST = function (gstRate = 18) {
  const taxableAmount = this.baseAmount - this.discountAmount;
  const gstAmount = (taxableAmount * gstRate) / 100;

  if (this.gstType === 'gst') { // CGST + SGST (within state)
    this.cgst = gstAmount / 2;
    this.sgst = gstAmount / 2;
    this.igst = 0;
    this.gstAmount = gstAmount;
  } else if (this.gstType === 'igst') { // IGST (out of state)
    this.igst = gstAmount;
    this.cgst = 0;
    this.sgst = 0;
    this.gstAmount = gstAmount;
  } else { // none - without GST
    this.cgst = 0;
    this.sgst = 0;
    this.igst = 0;
    this.gstAmount = 0;
  }

  this.totalAmount = taxableAmount + this.gstAmount;
  this.totalPrice = this.totalAmount; // Keep both fields in sync
};

// Method to add restaurant bill
roomBookingSchema.methods.addRestaurantBill = function(billData) {
  const bill = {
    date: billData.date || new Date(),
    amount: billData.amount,
    description: billData.description,
    addedBy: billData.addedBy || 'Receptionist',
    createdAt: new Date()
  };
  
  this.restaurantBills.push(bill);
  this.restaurantTotal += billData.amount;
  
  return this.save();
};

// Method to calculate total restaurant amount
roomBookingSchema.methods.calculateRestaurantTotal = function() {
  this.restaurantTotal = this.restaurantBills.reduce((total, bill) => total + bill.amount, 0);
  return this.restaurantTotal;
};

// Method to get grand total (room + restaurant)
roomBookingSchema.methods.getGrandTotal = function() {
  return this.totalAmount + this.restaurantTotal;
};

// Method to check in guest
roomBookingSchema.methods.checkIn = function() {
  this.status = 'checked-in';
  this.actualCheckInTime = new Date();
  return this.save();
};

// Method to check out guest
roomBookingSchema.methods.checkOut = function() {
  this.status = 'checked-out';
  this.actualCheckOutTime = new Date();
  return this.save();
};

// Method to extend booking
roomBookingSchema.methods.extendBooking = function(newCheckOutDate, additionalAmount) {
  const extension = {
    previousCheckOutDate: this.checkOutDate,
    newCheckOutDate: newCheckOutDate,
    additionalNights: Math.ceil((newCheckOutDate.getTime() - this.checkOutDate.getTime()) / (1000 * 3600 * 24)),
    additionalAmount: additionalAmount,
    extendedAt: new Date()
  };
  
  this.extensions.push(extension);
  this.checkOutDate = newCheckOutDate;
  this.totalAmount += additionalAmount;
  this.totalPrice = this.totalAmount; // Keep both fields in sync
  
  // Recalculate nights
  const timeDiff = this.checkOutDate.getTime() - this.checkInDate.getTime();
  this.nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  return this.save();
};

// Method to request cancellation
roomBookingSchema.methods.requestCancellation = function(reason) {
  this.status = 'cancel-requested';
  this.cancellationReason = reason;
  return this.save();
};

// Method to cancel booking
roomBookingSchema.methods.cancelBooking = function(reason, cancellationCharges = 0, refundAmount = null) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancellationCharges = cancellationCharges;
  this.refundAmount = refundAmount || (this.amountPaid - cancellationCharges);
  
  if (this.refundAmount > 0) {
    this.paymentStatus = 'refunded';
  }
  
  return this.save();
};

// Pre-save middleware to calculate nights and restaurant total
roomBookingSchema.pre('save', function (next) {
  if (this.checkInDate && this.checkOutDate) {
    const timeDiff = this.checkOutDate.getTime() - this.checkInDate.getTime();
    this.nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  
  // Recalculate restaurant total if bills changed
  if (this.isModified('restaurantBills')) {
    this.restaurantTotal = this.restaurantBills.reduce((total, bill) => total + bill.amount, 0);
  }
  
  // Keep totalPrice in sync with totalAmount
  if (this.isModified('totalAmount')) {
    this.totalPrice = this.totalAmount;
  }
  
  next();
});

module.exports = mongoose.model('RoomBooking', roomBookingSchema);