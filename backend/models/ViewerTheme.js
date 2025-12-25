const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ViewerTheme = sequelize.define('ViewerTheme', {
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
  createdById: {
    type: DataTypes.UUID,
    allowNull: true // null for built-in themes
  },
  isBuiltIn: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // Line ordering (array of line types in display order)
  lineOrder: {
    type: DataTypes.JSON,
    defaultValue: ['original', 'transliteration', 'translation'],
    get() {
      const rawValue = this.getDataValue('lineOrder');
      return Array.isArray(rawValue) ? rawValue : ['original', 'transliteration', 'translation'];
    }
  },
  // Per-line styling
  lineStyles: {
    type: DataTypes.JSON,
    defaultValue: {
      original: {
        fontSize: 100,
        fontWeight: '500',
        color: '#FFFFFF',
        opacity: 1,
        visible: true
      },
      transliteration: {
        fontSize: 90,
        fontWeight: '400',
        color: '#FFFFFF',
        opacity: 0.95,
        visible: true
      },
      translation: {
        fontSize: 90,
        fontWeight: '400',
        color: '#FFFFFF',
        opacity: 0.95,
        visible: true
      }
    }
  },
  // Content positioning
  positioning: {
    type: DataTypes.JSON,
    defaultValue: {
      vertical: 'center',      // 'top', 'center', 'bottom', 'custom'
      horizontal: 'center',    // 'left', 'center', 'right'
      customTop: null,         // percentage if vertical='custom'
      customLeft: null         // percentage if horizontal='custom'
    }
  },
  // Container styling
  container: {
    type: DataTypes.JSON,
    defaultValue: {
      maxWidth: '100%',
      padding: '2vh 6vw',
      backgroundColor: 'transparent',
      borderRadius: '0px'
    }
  },
  // Overall viewer background
  viewerBackground: {
    type: DataTypes.JSON,
    defaultValue: {
      type: 'inherit',         // 'inherit' (from room), 'color', 'transparent'
      color: null
    }
  },
  // WYSIWYG absolute positioning for each line (null = use legacy flexbox positioning)
  linePositions: {
    type: DataTypes.JSON,
    defaultValue: null,        // When set: { original: { x, y, width, height }, ... } all in %
    allowNull: true
  },
  // Canvas dimensions for the visual editor (reference resolution)
  canvasDimensions: {
    type: DataTypes.JSON,
    defaultValue: { width: 1920, height: 1080 }
  },
  // Background boxes (up to 3 boxes behind text)
  backgroundBoxes: {
    type: DataTypes.JSON,
    defaultValue: [],  // Array of { id, x, y, width, height, color, opacity, borderRadius }
    allowNull: true
  }
}, {
  tableName: 'viewer_themes',
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
      fields: ['isBuiltIn']
    },
    {
      fields: ['name']
    }
  ]
});

// Override toJSON to include _id in serialized output
ViewerTheme.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

// Classic theme constant for seeding
ViewerTheme.CLASSIC_THEME_ID = '00000000-0000-0000-0000-000000000001';

ViewerTheme.CLASSIC_THEME = {
  id: ViewerTheme.CLASSIC_THEME_ID,
  name: 'Classic',
  isBuiltIn: true,
  createdById: null,
  lineOrder: ['original', 'transliteration', 'translation'],
  lineStyles: {
    original: {
      fontSize: 100,
      fontWeight: '500',
      color: '#FFFFFF',
      opacity: 1,
      visible: true
    },
    transliteration: {
      fontSize: 90,
      fontWeight: '400',
      color: '#FFFFFF',
      opacity: 0.95,
      visible: true
    },
    translation: {
      fontSize: 90,
      fontWeight: '400',
      color: '#FFFFFF',
      opacity: 0.95,
      visible: true
    }
  },
  positioning: {
    vertical: 'center',
    horizontal: 'center',
    customTop: null,
    customLeft: null
  },
  container: {
    maxWidth: '100%',
    padding: '2vh 6vw',
    backgroundColor: 'transparent',
    borderRadius: '0px'
  },
  viewerBackground: {
    type: 'inherit',
    color: null
  },
  linePositions: null,
  canvasDimensions: { width: 1920, height: 1080 },
  backgroundBoxes: []
};

// Seed the Classic theme if it doesn't exist
ViewerTheme.seedClassicTheme = async function() {
  const existing = await ViewerTheme.findByPk(ViewerTheme.CLASSIC_THEME_ID);
  if (!existing) {
    await ViewerTheme.create(ViewerTheme.CLASSIC_THEME);
    console.log('Classic theme seeded');
  }
};

module.exports = ViewerTheme;
