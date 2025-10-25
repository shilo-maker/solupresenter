const mongoose = require('mongoose');
const Song = require('../models/Song');

const PROD_MONGODB_URI = 'mongodb+srv://solupresenter:Sud5a62oLS9SBtCu@cluster0.8flpy2z.mongodb.net/solupresenter?retryWrites=true&w=majority&appName=Cluster0';

async function deleteProductionSongs() {
  try {
    await mongoose.connect(PROD_MONGODB_URI);
    console.log('✅ Connected to PRODUCTION MongoDB\n');

    const count = await Song.countDocuments();
    console.log(`📊 Found ${count} songs in production database`);

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
  }
}

deleteProductionSongs();
