const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/sequelize');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    },
    set(value) {
      this.setDataValue('email', value.toLowerCase().trim());
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  authProvider: {
    type: DataTypes.ENUM('local', 'google'),
    defaultValue: 'local',
    allowNull: false
  },
  googleId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('operator', 'admin'),
    defaultValue: 'operator',
    allowNull: false
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      defaultLanguage: 'en'
    }
  },
  activeRoomId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emailVerificationExpires: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  indexes: [
    {
      fields: ['email']
    },
    {
      fields: ['emailVerificationToken']
    },
    {
      fields: ['activeRoomId']
    },
    {
      fields: ['googleId'],
      unique: true,
      where: {
        googleId: { [sequelize.Sequelize.Op.ne]: null }
      }
    }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password && user.authProvider === 'local') {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password && user.authProvider === 'local') {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  if (this.authProvider !== 'local' || !this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = User;
