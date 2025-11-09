const mongoose = require('mongoose');

const bibleVerseSchema = new mongoose.Schema({
  // Book information
  book: {
    type: String,
    required: true,
    index: true
  },
  bookNumber: {
    type: Number,
    required: true
  },
  testament: {
    type: String,
    enum: ['old', 'new'],
    required: true,
    index: true
  },

  // Chapter and verse
  chapter: {
    type: Number,
    required: true,
    index: true
  },
  verse: {
    type: Number,
    required: true
  },

  // Text content
  hebrewText: {
    type: String,
    default: ''
  },
  englishText: {
    type: String,
    default: ''
  },

  // For easy querying
  reference: {
    type: String,
    required: true,
    index: true  // e.g., "Genesis 1:1" or "John 3:16"
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
bibleVerseSchema.index({ book: 1, chapter: 1, verse: 1 });
bibleVerseSchema.index({ testament: 1, bookNumber: 1, chapter: 1, verse: 1 });

const BibleVerse = mongoose.model('BibleVerse', bibleVerseSchema);

module.exports = BibleVerse;
