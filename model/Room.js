const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
  floor: {
    type: String,
    required: true,
    enum: ['First Floor', 'Second Floor'],
    default: 'First Floor',
  },
  roomType: {
    type: String,
    required: true,
    enum: ['Single', 'Double', 'Suite', 'Deluxe', 'Family', 'Presidential'],
    default: 'Single',
  },
  price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  images: [{
    type: String,
    trim: true,
  }],
  amenities: {
    tv: { type: Boolean, default: false },
    ac: { type: Boolean, default: false },
    wifi: { type: Boolean, default: false },
    minibar: { type: Boolean, default: false },
    roomService: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false },
    bathtub: { type: Boolean, default: false },
    shower: { type: Boolean, default: false },
    hairDryer: { type: Boolean, default: false },
    safe: { type: Boolean, default: false },
    telephone: { type: Boolean, default: false },
    coffeeMaker: { type: Boolean, default: false },
    iron: { type: Boolean, default: false },
    workspace: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
  },
  capacity: {
    adults: { type: Number, default: 2 },
    children: { type: Number, default: 0 },
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  roomNumber: {
    type: String,
    trim: true,
  },
  // Hourly Pricing Options
  hourlyPricing: {
    enabled: { type: Boolean, default: false },
    threeHours: { type: Number, default: 0 },
    sixHours: { type: Number, default: 0 },
    nineHours: { type: Number, default: 0 },
    twelveHours: { type: Number, default: 0 },
  },
  // Housekeeping Status
  housekeepingStatus: {
    type: String,
    enum: ['clean', 'dirty', 'in-progress', 'inspected', 'out-of-order'],
    default: 'clean',
  },
  lastCleanedAt: {
    type: Date,
    default: null,
  },
  lastCleanedBy: {
    type: String,
    default: null,
  },
  cleaningNotes: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true
});

// Index for efficient queries
roomSchema.index({ branchId: 1 });
roomSchema.index({ roomNumber: 1 });
roomSchema.index({ housekeepingStatus: 1 });
roomSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('Room', roomSchema);