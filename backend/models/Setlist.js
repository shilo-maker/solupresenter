const mongoose = require('mongoose');

const setlistItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['song', 'blank', 'image', 'bible'],
    required: true
  },
  song: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    required: function() {
      return this.type === 'song';
    }
  },
  image: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media',
    required: function() {
      return this.type === 'image';
    }
  },
  bibleData: {
    type: {
      book: String,
      chapter: Number,
      title: String,
      slides: [{
        originalText: String,
        translation: String,
        verseNumber: Number,
        reference: String,
        hebrewReference: String
      }]
    },
    required: function() {
      return this.type === 'bible';
    }
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: false });

const setlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  items: [setlistItemSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isTemporary: {
    type: Boolean,
    default: false
  },
  linkedRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  },
  shareToken: {
    type: String,
    unique: true,
    sparse: true
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
setlistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Setlist', setlistSchema);
