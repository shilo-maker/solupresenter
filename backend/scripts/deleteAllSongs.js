require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('../models/Song');

async function deleteAllSongs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Count songs before deletion
    const count = await Song.countDocuments();
    console.log(`\n📊 Found ${count} songs in the database`);

    if (count === 0) {
      console.log('✅ No songs to delete');
      process.exit(0);
    }

    // Delete all songs
    const result = await Song.deleteMany({});
    console.log(`\n✅ Successfully deleted ${result.deletedCount} songs`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error deleting songs:', error.message);
    process.exit(1);
  }
}

// Run the script
deleteAllSongs();
