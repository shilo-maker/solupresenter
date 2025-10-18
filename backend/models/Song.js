const mongoose = require('mongoose');

const slideSchema = new mongoose.Schema({
  originalText: {
    type: String,
    required: true
  },
  transliteration: {
    type: String,
    default: ''
  },
  translation: {
    type: String,
    default: ''
  },
  translationOverflow: {
    type: String,
    default: ''
  },
  verseType: {
    type: String,
    default: ''
  }
}, { _id: false });

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  originalLanguage: {
    type: String,
    required: true,
    enum: ['he', 'en', 'es', 'fr', 'de', 'ru', 'ar', 'other']
  },
  slides: [slideSchema],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  isPendingApproval: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,  // Allow null for migrated songs
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  backgroundImage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
songSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for searching
songSchema.index({ title: 'text', 'slides.originalText': 'text' });
songSchema.index({ tags: 1 });
songSchema.index({ isPublic: 1, createdBy: 1 });

module.exports = mongoose.model('Song', songSchema);
