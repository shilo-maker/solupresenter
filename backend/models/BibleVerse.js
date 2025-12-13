const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const BibleVerse = sequelize.define('BibleVerse', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  book: {
    type: DataTypes.STRING,
    allowNull: false
  },
  bookNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  testament: {
    type: DataTypes.ENUM('old', 'new'),
    allowNull: false
  },
  chapter: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  verse: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  hebrewText: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  englishText: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g., "Genesis 1:1" or "John 3:16"'
  }
}, {
  tableName: 'bible_verses',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['book']
    },
    {
      fields: ['testament']
    },
    {
      fields: ['chapter']
    },
    {
      fields: ['reference']
    },
    {
      fields: ['book', 'chapter', 'verse']
    },
    {
      fields: ['testament', 'bookNumber', 'chapter', 'verse']
    }
  ]
});

// Override toJSON to include _id in serialized output (for MongoDB-style frontend compatibility)
BibleVerse.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = BibleVerse;
