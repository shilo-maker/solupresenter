const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Song = require('../models/Song');
const User = require('../models/User');

const PROD_MONGODB_URI = 'mongodb+srv://solupresenter:Sud5a62oLS9SBtCu@cluster0.8flpy2z.mongodb.net/solupresenter?retryWrites=true&w=majority&appName=Cluster0';

async function importProductionSongs() {
  try {
    await mongoose.connect(PROD_MONGODB_URI);
    console.log('✅ Connected to PRODUCTION MongoDB\n');

    // Read export file
    const exportPath = path.join(__dirname, '../songs_export.json');
    if (!fs.existsSync(exportPath)) {
      console.error('❌ Export file not found:', exportPath);
      process.exit(1);
    }

    const songsData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    console.log(`📥 Found ${songsData.length} songs to import\n`);

    // Find admin user
    let adminUser = await User.findOne({ role: 'admin' });

    if (!adminUser) {
      console.error('❌ No admin user found in production. Please create one first.');
      process.exit(1);
    }

    console.log(`Using admin user: ${adminUser.email}`);
    console.log('\nStarting import...\n');

    let successCount = 0;
    let failCount = 0;

    for (const songData of songsData) {
      try {
        // Remove MongoDB-specific fields
        const { _id, __v, createdBy, createdAt, updatedAt, ...cleanSongData } = songData;

        // Create song with admin as creator
        await Song.create({
          ...cleanSongData,
          createdBy: adminUser._id
        });

        successCount++;
        if (successCount % 50 === 0) {
          console.log(`  Imported ${successCount}/${songsData.length} songs...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to import "${songData.title}":`, error.message);
        failCount++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`   Total: ${songsData.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

importProductionSongs();
