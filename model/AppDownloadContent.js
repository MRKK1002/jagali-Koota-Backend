const mongoose = require('mongoose');

const downloadLinksSchema = new mongoose.Schema({
  android: {
    type: String,
    trim: true,
    default: 'https://play.google.com/store/apps/details?id=com.hotelvirat'
  },
  ios: {
    type: String,
    trim: true,
    default: '#'
  }
});

const appDownloadContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'Download Our App'
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
  features: [{
    type: String,
    trim: true
  }],
  downloadLinks: downloadLinksSchema,
  appImages: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AppDownloadContent', appDownloadContentSchema);