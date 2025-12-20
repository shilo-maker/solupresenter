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
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'File size in bytes (null for gradients/URLs)'
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

// Override toJSON to include _id in serialized output (for MongoDB-style frontend compatibility)
Media.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = Media;
