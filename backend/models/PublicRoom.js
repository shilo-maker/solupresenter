const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const PublicRoom = sequelize.define('PublicRoom', {
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
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    set(value) {
      // Convert to lowercase and replace spaces/special chars with hyphens
      const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ''); // Strip leading/trailing hyphens
      this.setDataValue('slug', slug);
    }
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  activeRoomId: {
    type: DataTypes.UUID,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'public_rooms',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['slug'],
      unique: true
    },
    {
      fields: ['ownerId']
    },
    {
      fields: ['activeRoomId']
    }
  ]
});

// Override toJSON to include _id in serialized output (for MongoDB-style frontend compatibility)
PublicRoom.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = PublicRoom;
