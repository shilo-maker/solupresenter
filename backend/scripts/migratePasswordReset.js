require('dotenv').config();
const { Sequelize } = require('sequelize');

// Connect to the database using DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable not found');
  process.exit(1);
}

console.log('🔄 Starting password reset migration...');
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

async function migrate() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Check if columns already exist
    const [results] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('passwordResetToken', 'passwordResetExpires');
    `);

    const existingColumns = results.map(r => r.column_name);

    if (existingColumns.includes('passwordResetToken') && existingColumns.includes('passwordResetExpires')) {
      console.log('ℹ️  Columns already exist, skipping migration');
      await sequelize.close();
      process.exit(0);
    }

    console.log('📝 Adding password reset columns...');

    // Add passwordResetToken column if it doesn't exist
    if (!existingColumns.includes('passwordResetToken')) {
      await sequelize.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "passwordResetToken" VARCHAR(255);
      `);
      console.log('✅ Added passwordResetToken column');
    } else {
      console.log('ℹ️  passwordResetToken column already exists');
    }

    // Add passwordResetExpires column if it doesn't exist
    if (!existingColumns.includes('passwordResetExpires')) {
      await sequelize.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP WITH TIME ZONE;
      `);
      console.log('✅ Added passwordResetExpires column');
    } else {
      console.log('ℹ️  passwordResetExpires column already exists');
    }

    // Create index if it doesn't exist
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "users_password_reset_token"
      ON users ("passwordResetToken");
    `);
    console.log('✅ Created index on passwordResetToken');

    console.log('🎉 Migration completed successfully!');
    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sequelize.close();
    process.exit(1);
  }
}

migrate();
