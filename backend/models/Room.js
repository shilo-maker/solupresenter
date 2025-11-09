const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  pin: {
    type: DataTypes.STRING(4),
    allowNull: false,
    unique: true,
    set(value) {
      this.setDataValue('pin', value.toUpperCase());
    }
  },
  operatorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  currentSlide: {
    type: DataTypes.JSONB,
    defaultValue: {
      songId: null,
      slideIndex: 0,
      displayMode: 'bilingual',
      isBlank: false
    }
  },
  currentImageUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  currentBibleData: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  backgroundImage: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  quickSlideText: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  viewerCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  temporarySetlistId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  linkedPermanentSetlistId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  lastActivity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  expiresAt: {
    type: DataTypes.DATE,
    defaultValue: () => new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
  }
}, {
  tableName: 'rooms',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  indexes: [
    {
      fields: ['pin'],
      unique: true
    },
    {
      fields: ['operatorId']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['pin', 'isActive']
    },
    {
      fields: ['lastActivity']
    },
    {
      fields: ['expiresAt']
    }
  ]
});

// Method to update activity
Room.prototype.updateActivity = async function() {
  this.lastActivity = new Date();
  this.expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // Reset to 2 hours from now
  return await this.save();
};

module.exports = Room;
