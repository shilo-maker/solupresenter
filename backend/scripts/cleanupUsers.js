require('dotenv').config();
const { Sequelize } = require('sequelize');
const { Op } = require('sequelize');

// Connect to the database using DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable not found');
  process.exit(1);
}

console.log('🔄 Starting user cleanup...');
console.log('📡 Connecting to database...');

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

// Import User model schema
const { DataTypes } = require('sequelize');
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  role: {
    type: DataTypes.ENUM('operator', 'admin'),
    defaultValue: 'operator'
  }
}, {
  tableName: 'users',
  timestamps: false
});

async function cleanupUsers() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Get count of all users
    const totalUsers = await User.count();
    console.log(`📊 Total users in database: ${totalUsers}`);

    // Get the admin user to preserve
    const adminUser = await User.findOne({
      where: { email: 'shilo@soluisrael.org' }
    });

    if (!adminUser) {
      console.error('❌ Error: Admin user shilo@soluisrael.org not found!');
      console.log('Cannot proceed with cleanup. Exiting safely.');
      await sequelize.close();
      process.exit(1);
    }

    console.log(`✅ Found admin user: ${adminUser.email} (${adminUser.role})`);
    console.log(`   User ID: ${adminUser.id}\n`);

    // Get count of users that will be deleted
    const usersToDelete = await User.count({
      where: {
        email: {
          [Op.ne]: 'shilo@soluisrael.org'
        }
      }
    });

    console.log(`⚠️  USERS TO DELETE: ${usersToDelete}`);
    console.log(`✅ USERS TO KEEP: 1 (shilo@soluisrael.org)\n`);

    if (usersToDelete === 0) {
      console.log('ℹ️  No users to delete. Database is already clean.');
      await sequelize.close();
      process.exit(0);
    }

    // Get list of users to be deleted (for logging)
    const usersListToDelete = await User.findAll({
      where: {
        email: {
          [Op.ne]: 'shilo@soluisrael.org'
        }
      },
      attributes: ['email', 'role']
    });

    console.log('📋 Users that will be deleted:');
    usersListToDelete.forEach(user => {
      console.log(`   - ${user.email} (${user.role})`);
    });
    console.log();

    // Perform the deletion
    console.log('🗑️  Deleting users...');
    const deletedCount = await User.destroy({
      where: {
        email: {
          [Op.ne]: 'shilo@soluisrael.org'
        }
      }
    });

    console.log(`✅ Successfully deleted ${deletedCount} users\n`);

    // Verify only admin user remains
    const remainingUsers = await User.findAll({
      attributes: ['email', 'role']
    });

    console.log('📋 Remaining users in database:');
    remainingUsers.forEach(user => {
      console.log(`   ✓ ${user.email} (${user.role})`);
    });

    console.log('\n🎉 User cleanup completed successfully!');
    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run the cleanup
cleanupUsers();
