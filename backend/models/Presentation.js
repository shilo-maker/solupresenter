const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Presentation = sequelize.define('Presentation', {
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
  slides: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false,
    comment: 'Array of slide objects with textBoxes for free-form presentation content'
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  canvasDimensions: {
    type: DataTypes.JSONB,
    defaultValue: { width: 1920, height: 1080 },
    allowNull: false
  },
  backgroundSettings: {
    type: DataTypes.JSONB,
    defaultValue: { type: 'color', value: '#000000' },
    allowNull: false
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'presentations',
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
      fields: ['title']
    },
    {
      fields: ['isPublic', 'createdById']
    },
    {
      fields: ['createdById']
    },
    {
      fields: ['updatedAt']
    }
  ]
});

// Override toJSON to include _id in serialized output
Presentation.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = Presentation;
