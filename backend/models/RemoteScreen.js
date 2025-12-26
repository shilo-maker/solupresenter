const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const RemoteScreen = sequelize.define('RemoteScreen', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  displayType: {
    type: DataTypes.ENUM('viewer', 'stage', 'obs'),
    defaultValue: 'viewer',
    allowNull: false
  },
  config: {
    type: DataTypes.JSON,
    defaultValue: {},
    allowNull: true,
    comment: 'Display-specific settings: fontSize, theme colors, visibility toggles, etc.'
  }
}, {
  tableName: 'remote_screens',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['userId']
    }
  ]
});

// Override toJSON to include _id in serialized output (for MongoDB-style frontend compatibility)
RemoteScreen.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = RemoteScreen;
