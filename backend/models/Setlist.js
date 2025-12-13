const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Setlist = sequelize.define('Setlist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      this.setDataValue('name', value.trim());
    }
  },
  items: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false,
    comment: 'Array of setlist items with type (song/blank/image/bible), song/image/bibleData, and order'
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false
  },
  isTemporary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  linkedRoomId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  shareToken: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  }
}, {
  tableName: 'setlists',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  getterMethods: {
    _id() {
      return this.id;
    }
  },
  indexes: [
    {
      fields: ['createdById']
    },
    {
      fields: ['isTemporary']
    },
    {
      fields: ['isTemporary', 'createdAt']
    },
    {
      fields: ['linkedRoomId']
    },
    {
      fields: ['updatedAt']
    },
    {
      fields: ['shareToken'],
      unique: true,
      where: {
        shareToken: { [sequelize.Sequelize.Op.ne]: null }
      }
    }
  ]
});

module.exports = Setlist;
