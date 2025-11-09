const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Song = sequelize.define('Song', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      this.setDataValue('title', value.trim());
    }
  },
  originalLanguage: {
    type: DataTypes.ENUM('he', 'en', 'es', 'fr', 'de', 'ru', 'ar', 'other'),
    defaultValue: 'he',
    allowNull: true
  },
  slides: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false,
    comment: 'Array of slide objects with originalText, transliteration, translation, translationOverflow, verseType'
  },
  tags: {
    // Use JSON for cross-database compatibility (works in both SQLite and PostgreSQL)
    type: DataTypes.JSON,
    defaultValue: [],
    get() {
      const rawValue = this.getDataValue('tags');
      // Ensure we always return an array
      return Array.isArray(rawValue) ? rawValue : [];
    },
    set(value) {
      if (Array.isArray(value)) {
        const normalized = value.map(tag => tag.toLowerCase().trim());
        this.setDataValue('tags', normalized);
      } else {
        this.setDataValue('tags', []);
      }
    }
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isPendingApproval: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  approvedById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  backgroundImage: {
    type: DataTypes.STRING,
    defaultValue: ''
  }
}, {
  tableName: 'songs',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    // Basic indexes that work in both SQLite and PostgreSQL
    {
      fields: ['title']
    },
    {
      fields: ['isPublic', 'createdById']
    },
    {
      fields: ['createdById']
    },
    {
      fields: ['originalLanguage']
    },
    {
      fields: ['isPendingApproval']
    },
    {
      fields: ['updatedAt']
    },
    {
      fields: ['usageCount']
    }
  ]
});

module.exports = Song;
