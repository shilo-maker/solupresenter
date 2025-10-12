require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('../models/Song');

async function updateSongsLanguage() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('\nUpdating all songs to Hebrew original language...\n');

    const result = await Song.updateMany(
      {}, // Update all songs
      { $set: { originalLanguage: 'he' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} songs to Hebrew (he)`);
    console.log(`   Total songs in database: ${result.matchedCount}`);

    console.log('\n✨ Update complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating songs:', error);
    process.exit(1);
  }
}

updateSongsLanguage();
