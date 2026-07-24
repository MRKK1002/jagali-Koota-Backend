const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Configuration name is required'],
    trim: true,
    maxlength: [100, 'Configuration name cannot exceed 100 characters']
  },
  configType: {
    type: String,
    required: [true, 'Configuration type is required'],
    enum: ['salary', 'leave', 'attendance'],
    trim: true
  },
  details: {
    type: String,
    required: [true, 'Details are required'],
    trim: true
  },
  createdBy: {
    type: String,
    required: [true, 'Created by is required'],
    trim: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  data: {
    baseSalary: { type: String, trim: true },
    bonusPercentage: { type: String, trim: true },
    taxRegime: { type: String, enum: ['new', 'old'], trim: true },
    hra: { type: String, trim: true },
    travelAllowance: { type: String, trim: true },
    medicalAllowance: { type: String, trim: true },
    annualLeave: { type: String, trim: true },
    sickLeave: { type: String, trim: true },
    accrualRate: { type: String, enum: ['monthly', 'quarterly', 'annually'], trim: true },
    carryForward: { type: Boolean, default: true },
    maxCarryForward: { type: String, trim: true },
    workingHours: { type: String, trim: true },
    latePenalty: { type: String, trim: true },
    remoteWork: { type: Boolean, default: false },
    overtimeRate: { type: String, trim: true },
    flexibleHours: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model('Configuration', configurationSchema);