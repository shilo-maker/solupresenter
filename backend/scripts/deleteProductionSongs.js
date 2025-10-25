const mongoose = require('mongoose');
const readline = require('readline');
const Song = require('../models/Song');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function deleteProductionSongs() {
  try {
    console.log('⚠️  WARNING: This will delete ALL songs from the PRODUCTION database!\n');

    const mongoUri = await question('Enter PRODUCTION MongoDB URI: ');

    if (!mongoUri || !mongoUri.includes('mongodb')) {
      console.error('❌ Invalid MongoDB URI');
      process.exit(1);
    }

    const confirm = await question('\n⚠️  Are you ABSOLUTELY SURE you want to delete ALL production songs? (type "DELETE" to confirm): ');

    if (confirm !== 'DELETE') {
      console.log('❌ Deletion cancelled');
      process.exit(0);
    }

    await mongoose.connect(mongoUri);
    console.log('\n✅ Connected to PRODUCTION MongoDB');

    const count = await Song.countDocuments();
    console.log(`📊 Found ${count} songs in production database\n`);

    if (count === 0) {
      console.log('✅ No songs to delete');
      process.exit(0);
    }

    const result = await Song.deleteMany({});
    console.log(`✅ Successfully deleted ${result.deletedCount} songs from PRODUCTION\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

deleteProductionSongs();
