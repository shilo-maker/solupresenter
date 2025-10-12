require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('../models/Song');

async function deleteMockSongs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const mockSongTitles = [
      'Forever Faithful',
      'Grace Unending',
      'Holy Spirit Come',
      'King of Glory',
      'Light of the World'
    ];

    console.log(`\nDeleting ${mockSongTitles.length} mock songs...\n`);

    for (const title of mockSongTitles) {
      const result = await Song.deleteOne({ title });
      if (result.deletedCount > 0) {
        console.log(`✅ Deleted: "${title}"`);
      } else {
        console.log(`⚠️  Song "${title}" not found`);
      }
    }

    console.log('\n✨ Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error deleting songs:', error);
    process.exit(1);
  }
}

deleteMockSongs();
