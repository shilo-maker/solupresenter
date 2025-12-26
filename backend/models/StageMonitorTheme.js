const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const StageMonitorTheme = sequelize.define('StageMonitorTheme', {
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
  // Canvas dimensions for the visual editor (reference resolution)
  canvasDimensions: {
    type: DataTypes.JSON,
    defaultValue: { width: 1920, height: 1080 }
  },
  // Overall theme colors
  colors: {
    type: DataTypes.JSON,
    defaultValue: {
      background: '#0a0a0a',
      text: '#ffffff',
      accent: '#4a90d9',
      secondary: '#888888',
      border: '#333333'
    }
  },
  // Header bar configuration
  header: {
    type: DataTypes.JSON,
    defaultValue: {
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 8,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#333333'
    }
  },
  // Clock configuration
  clock: {
    type: DataTypes.JSON,
    defaultValue: {
      visible: true,
      x: 85,
      y: 1,
      width: 13,
      height: 6,
      fontSize: 100,
      fontWeight: 'bold',
      color: '#ffffff',
      fontFamily: 'monospace'
    }
  },
  // Song title configuration
  songTitle: {
    type: DataTypes.JSON,
    defaultValue: {
      visible: true,
      x: 2,
      y: 1,
      width: 60,
      height: 6,
      fontSize: 100,
      fontWeight: '600',
      color: '#4a90d9'
    }
  },
  // Current slide area configuration
  currentSlideArea: {
    type: DataTypes.JSON,
    defaultValue: {
      x: 2,
      y: 12,
      width: 64,
      height: 84,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#333333',
      padding: 2
    }
  },
  // Text styles for current slide content
  currentSlideText: {
    type: DataTypes.JSON,
    defaultValue: {
      original: {
        visible: true,
        fontSize: 100,
        fontWeight: 'bold',
        color: '#ffffff',
        opacity: 1
      },
      transliteration: {
        visible: true,
        fontSize: 80,
        fontWeight: '400',
        color: '#888888',
        opacity: 1
      },
      translation: {
        visible: true,
        fontSize: 80,
        fontWeight: '400',
        color: '#ffffff',
        opacity: 0.9
      }
    }
  },
  // Next slide preview area configuration
  nextSlideArea: {
    type: DataTypes.JSON,
    defaultValue: {
      visible: true,
      x: 68,
      y: 12,
      width: 30,
      height: 84,
      backgroundColor: '#1a1a1a',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#333333',
      opacity: 0.8,
      labelText: 'Next',
      labelColor: '#888888',
      labelFontSize: 90
    }
  },
  // Background boxes (up to 3 boxes behind content)
  backgroundBoxes: {
    type: DataTypes.JSON,
    defaultValue: [],
    allowNull: true
  }
}, {
  tableName: 'stage_monitor_themes',
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
StageMonitorTheme.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

// Classic Dark theme constant for seeding
StageMonitorTheme.CLASSIC_DARK_THEME_ID = '00000000-0000-0000-0000-000000000010';

StageMonitorTheme.CLASSIC_DARK_THEME = {
  id: StageMonitorTheme.CLASSIC_DARK_THEME_ID,
  name: 'Classic Dark',
  isBuiltIn: true,
  createdById: null,
  canvasDimensions: { width: 1920, height: 1080 },
  colors: {
    background: '#0a0a0a',
    text: '#ffffff',
    accent: '#4a90d9',
    secondary: '#888888',
    border: '#333333'
  },
  header: {
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#333333'
  },
  clock: {
    visible: true,
    x: 85,
    y: 1,
    width: 13,
    height: 6,
    fontSize: 100,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace'
  },
  songTitle: {
    visible: true,
    x: 2,
    y: 1,
    width: 60,
    height: 6,
    fontSize: 100,
    fontWeight: '600',
    color: '#4a90d9'
  },
  currentSlideArea: {
    x: 2,
    y: 12,
    width: 64,
    height: 84,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 2
  },
  currentSlideText: {
    original: {
      visible: true,
      fontSize: 100,
      fontWeight: 'bold',
      color: '#ffffff',
      opacity: 1
    },
    transliteration: {
      visible: true,
      fontSize: 80,
      fontWeight: '400',
      color: '#888888',
      opacity: 1
    },
    translation: {
      visible: true,
      fontSize: 80,
      fontWeight: '400',
      color: '#ffffff',
      opacity: 0.9
    }
  },
  nextSlideArea: {
    visible: true,
    x: 68,
    y: 12,
    width: 30,
    height: 84,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    opacity: 0.8,
    labelText: 'Next',
    labelColor: '#888888',
    labelFontSize: 90
  },
  backgroundBoxes: []
};

// Classic Light theme
StageMonitorTheme.CLASSIC_LIGHT_THEME_ID = '00000000-0000-0000-0000-000000000011';

StageMonitorTheme.CLASSIC_LIGHT_THEME = {
  id: StageMonitorTheme.CLASSIC_LIGHT_THEME_ID,
  name: 'Classic Light',
  isBuiltIn: true,
  createdById: null,
  canvasDimensions: { width: 1920, height: 1080 },
  colors: {
    background: '#f5f5f5',
    text: '#1a1a1a',
    accent: '#0066cc',
    secondary: '#666666',
    border: '#cccccc'
  },
  header: {
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cccccc'
  },
  clock: {
    visible: true,
    x: 85,
    y: 1,
    width: 13,
    height: 6,
    fontSize: 100,
    fontWeight: 'bold',
    color: '#1a1a1a',
    fontFamily: 'monospace'
  },
  songTitle: {
    visible: true,
    x: 2,
    y: 1,
    width: 60,
    height: 6,
    fontSize: 100,
    fontWeight: '600',
    color: '#0066cc'
  },
  currentSlideArea: {
    x: 2,
    y: 12,
    width: 64,
    height: 84,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cccccc',
    padding: 2
  },
  currentSlideText: {
    original: {
      visible: true,
      fontSize: 100,
      fontWeight: 'bold',
      color: '#1a1a1a',
      opacity: 1
    },
    transliteration: {
      visible: true,
      fontSize: 80,
      fontWeight: '400',
      color: '#666666',
      opacity: 1
    },
    translation: {
      visible: true,
      fontSize: 80,
      fontWeight: '400',
      color: '#1a1a1a',
      opacity: 0.9
    }
  },
  nextSlideArea: {
    visible: true,
    x: 68,
    y: 12,
    width: 30,
    height: 84,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cccccc',
    opacity: 0.8,
    labelText: 'Next',
    labelColor: '#666666',
    labelFontSize: 90
  },
  backgroundBoxes: []
};

// Seed the built-in themes if they don't exist
StageMonitorTheme.seedBuiltInThemes = async function() {
  const existingDark = await StageMonitorTheme.findByPk(StageMonitorTheme.CLASSIC_DARK_THEME_ID);
  if (!existingDark) {
    await StageMonitorTheme.create(StageMonitorTheme.CLASSIC_DARK_THEME);
    console.log('Stage Monitor Classic Dark theme seeded');
  }

  const existingLight = await StageMonitorTheme.findByPk(StageMonitorTheme.CLASSIC_LIGHT_THEME_ID);
  if (!existingLight) {
    await StageMonitorTheme.create(StageMonitorTheme.CLASSIC_LIGHT_THEME);
    console.log('Stage Monitor Classic Light theme seeded');
  }
};

module.exports = StageMonitorTheme;
