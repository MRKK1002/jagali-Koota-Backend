const mongoose = require('mongoose');

const housekeepingSchema = new mongoose.Schema({
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
  assignedTo: {
    type: String,
    trim: true,
    default: null, // Housekeeper name or ID
  },
  assignedBy: {
    type: String,
    trim: true,
    default: null, // Admin/Receptionist who assigned
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'inspected', 'failed'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  taskType: {
    type: String,
    enum: ['regular-cleaning', 'deep-cleaning', 'checkout-cleaning', 'maintenance', 'inspection'],
    default: 'regular-cleaning',
  },
  scheduledDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  scheduledTime: {
    type: String,
    default: '10:00', // Default cleaning time
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  duration: {
    type: Number, // Duration in minutes
    default: 0,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  checklistItems: [{
    item: { type: String, required: true },
    completed: { type: Boolean, default: false },
    notes: { type: String, default: '' }
  }],
  issuesFound: [{
    issue: { type: String, required: true },
    severity: { type: String, enum: ['minor', 'major', 'critical'], default: 'minor' },
    reportedAt: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false }
  }],
  images: [{
    type: String, // Before/after cleaning images
    trim: true,
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null, // Quality rating after inspection
  },
  inspectedBy: {
    type: String,
    default: null,
  },
  inspectionNotes: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true
});

// Indexes for efficient queries
housekeepingSchema.index({ roomId: 1, scheduledDate: -1 });
housekeepingSchema.index({ branchId: 1 });
housekeepingSchema.index({ status: 1 });
housekeepingSchema.index({ assignedTo: 1 });
housekeepingSchema.index({ scheduledDate: 1 });
housekeepingSchema.index({ priority: 1 });

// Method to start task
housekeepingSchema.methods.startTask = function() {
  this.status = 'in-progress';
  this.startedAt = new Date();
  return this.save();
};

// Method to complete task
housekeepingSchema.methods.completeTask = function(notes = '') {
  this.status = 'completed';
  this.completedAt = new Date();
  if (this.startedAt) {
    this.duration = Math.round((this.completedAt - this.startedAt) / 60000); // Duration in minutes
  }
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Method to mark as inspected
housekeepingSchema.methods.inspect = function(inspectedBy, rating, notes = '') {
  this.status = 'inspected';
  this.inspectedBy = inspectedBy;
  this.rating = rating;
  this.inspectionNotes = notes;
  return this.save();
};

// Pre-save middleware to calculate duration
housekeepingSchema.pre('save', function(next) {
  if (this.startedAt && this.completedAt && this.duration === 0) {
    this.duration = Math.round((this.completedAt - this.startedAt) / 60000);
  }
  next();
});

module.exports = mongoose.model('Housekeeping', housekeepingSchema);