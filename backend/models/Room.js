const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  pin: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 4
  },
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentSlide: {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      default: null
    },
    slideIndex: {
      type: Number,
      default: 0
    },
    displayMode: {
      type: String,
      enum: ['original', 'bilingual'],
      default: 'bilingual'
    },
    isBlank: {
      type: Boolean,
      default: false
    }
  },
  currentImageUrl: {
    type: String,
    default: null
  },
  currentBibleData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  backgroundImage: {
    type: String,
    default: ''
  },
  quickSlideText: {
    type: String,
    default: ''
  },
  viewerCount: {
    type: Number,
    default: 0
  },
  temporarySetlist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Setlist',
    default: null
  },
  linkedPermanentSetlist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Setlist',
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    }
  }
});

// Indexes for optimized queries
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
roomSchema.index({ pin: 1 }); // For PIN lookups
roomSchema.index({ operator: 1 }); // For user's rooms
roomSchema.index({ isActive: 1 }); // For active rooms
roomSchema.index({ pin: 1, isActive: 1 }); // Compound for viewer joins
roomSchema.index({ lastActivity: -1 }); // For sorting by activity

// Update lastActivity and expiresAt
roomSchema.methods.updateActivity = function() {
  this.lastActivity = Date.now();
  this.expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // Reset to 2 hours from now
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema);
