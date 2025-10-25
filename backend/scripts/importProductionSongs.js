const mongoose = require('mongoose');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const Song = require('../models/Song');
const User = require('../models/User');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function importProductionSongs() {
  try {
    console.log('📤 This will import all songs from songs_export.json to PRODUCTION database\n');

    const mongoUri = await question('Enter PRODUCTION MongoDB URI: ');

    if (!mongoUri || !mongoUri.includes('mongodb')) {
      console.error('❌ Invalid MongoDB URI');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('\n✅ Connected to PRODUCTION MongoDB');

    // Read export file
    const exportPath = path.join(__dirname, '../songs_export.json');
    if (!fs.existsSync(exportPath)) {
      console.error('❌ Export file not found:', exportPath);
      process.exit(1);
    }

    const songsData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    console.log(`📥 Found ${songsData.length} songs to import\n`);

    // Find or create admin user to assign songs to
    let adminUser = await User.findOne({ role: 'admin' });

    if (!adminUser) {
      console.log('⚠️  No admin user found in production');
      const adminEmail = await question('Enter admin email to create/find: ');

      adminUser = await User.findOne({ email: adminEmail.toLowerCase() });

      if (!adminUser) {
        console.log('❌ User not found. Please ensure an admin user exists in production first.');
        process.exit(1);
      }
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
  } finally {
    rl.close();
  }
}

importProductionSongs();
