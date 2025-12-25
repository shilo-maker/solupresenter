const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const SongMapping = sequelize.define('SongMapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  soluflowId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    // unique constraint defined via index below
    comment: 'SoluFlow song ID (from external database)'
  },
  soluflowTitle: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Cached SoluFlow song title for display'
  },
  solupresenterId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'SoluPresenter song ID (null if marked as no match)'
  },
  solupresenterTitle: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Cached SoluPresenter song title for display'
  },
  confidence: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'Match confidence percentage (0-100), null for manual matches'
  },
  manuallyLinked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'True if manually linked by user, false if auto-matched'
  },
  noMatch: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'True if user confirmed no matching song exists in SoluPresenter'
  }
}, {
  tableName: 'song_mappings',
  timestamps: true,
  indexes: [
    {
      fields: ['soluflowId'],
      unique: true
    },
    {
      fields: ['solupresenterId']
    },
    {
      fields: ['noMatch']
    }
  ]
});

module.exports = SongMapping;
