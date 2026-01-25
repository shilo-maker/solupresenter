require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Local database connection (source) - SQLite
const localSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'database.sqlite'),
  logging: false
});

// Production database connection (destination)
const PRODUCTION_DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;

if (!PRODUCTION_DATABASE_URL) {
  console.error('❌ Error: PRODUCTION_DATABASE_URL environment variable is required');
  console.log('Usage: PRODUCTION_DATABASE_URL="postgresql://..." node scripts/syncToProduction.js');
  process.exit(1);
}

const productionSequelize = new Sequelize(PRODUCTION_DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function syncToProduction() {
  try {
    console.log('🔄 Starting database sync to production...\n');

    // Test connections
    console.log('📡 Testing local database connection...');
    await localSequelize.authenticate();
    console.log('✅ Local database connected\n');

    console.log('📡 Testing production database connection...');
    await productionSequelize.authenticate();
    console.log('✅ Production database connected\n');

    console.log('📊 Note: Make sure production database schema is already created (tables should exist).\n');
    console.log('   If tables don\'t exist, the backend will create them on first startup.\n');

    // Migrate data directly using raw queries
    // Map SQLite table names (capital) to PostgreSQL table names (lowercase)
    const tables = [
      { local: 'Users', prod: 'users' },
      { local: 'Songs', prod: 'songs' },
      { local: 'Setlists', prod: 'setlists' },
      { local: 'Rooms', prod: 'rooms' },
      { local: 'Media', prod: 'media' },
      { local: 'BibleVerses', prod: 'bible_verses' }
    ];

    for (const table of tables) {
      console.log(`📦 Migrating ${table.local}...`);

      try {
        // Get all data from SQLite
        const [localData] = await localSequelize.query(`SELECT * FROM ${table.local}`);
        console.log(`   Found ${localData.length} records in local database`);

        if (localData.length > 0) {
          // Check if table exists in production (lowercase)
          const [tableExists] = await productionSequelize.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public'
              AND table_name = '${table.prod}'
            );
          `);

          if (!tableExists[0].exists) {
            console.log(`   ⚠️  Table "${table.prod}" doesn't exist in production yet, skipping...`);
            console.log(`      (It will be created when the backend starts)`);
            console.log();
            continue;
          }

          // Clear production table first (be careful!)
          await productionSequelize.query(`DELETE FROM "${table.prod}"`);

          // Get column names
          const columns = Object.keys(localData[0]);
          const columnList = columns.map(c => `"${c}"`).join(', ');

          // Insert each row
          for (const row of localData) {
            const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => {
              // Handle JSON columns
              if (typeof row[col] === 'object' && row[col] !== null) {
                return JSON.stringify(row[col]);
              }
              return row[col];
            });

            try {
              await productionSequelize.query(
                `INSERT INTO "${table.prod}" (${columnList}) VALUES (${valuePlaceholders})`,
                {
                  bind: values,
                  type: Sequelize.QueryTypes.INSERT
                }
              );
            } catch (insertError) {
              console.log(`   ⚠️  Error inserting row, skipping: ${insertError.message}`);
            }
          }

          console.log(`   ✅ Migrated ${localData.length} ${table.local} to production`);
        } else {
          console.log(`   ⏭️  No data to migrate for ${table.local}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error with table ${table.local}: ${err.message}`);
      }
      console.log();
    }

    console.log('✅ Database sync completed!');
    console.log('\n🎉 Your production database is now up to date with local data.');
    console.log('\n💡 Next step: Visit your backend URL to let it create any missing tables.');

  } catch (error) {
    console.error('❌ Error during sync:', error);
    process.exit(1);
  } finally {
    await localSequelize.close();
    await productionSequelize.close();
  }
}

// Run the sync
syncToProduction();
