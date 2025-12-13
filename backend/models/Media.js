const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Media = sequelize.define('Media', {
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
  type: {
    type: DataTypes.ENUM('image', 'video'),
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  thumbnailUrl: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  uploadedById: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  tableName: 'media',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  getterMethods: {
    _id() {
      return this.id;
    }
  },
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['isPublic', 'uploadedById']
    },
    {
      fields: ['uploadedById']
    }
  ]
});

module.exports = Media;
