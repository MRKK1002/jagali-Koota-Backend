const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
  icon: {
    type: String,
    required: true,
    enum: ['utensils', 'users', 'clock', 'star', 'heart', 'award', 'shield', 'thumbs-up']
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  }
});

const contactInfoSchema = new mongoose.Schema({
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  }
});

const cateringContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Catering Service Available'
  },
  subtitle: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  features: [featureSchema],
  services: [{
    type: String,
    trim: true
  }],
  contactInfo: contactInfoSchema,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CateringContent', cateringContentSchema);