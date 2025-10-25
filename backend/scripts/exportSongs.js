require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Song = require('../models/Song');
const User = require('../models/User');

async function exportSongs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const songs = await Song.find({}).populate('createdBy', 'email').lean();
    console.log(`Found ${songs.length} songs to export\n`);

    // Convert to JSON with createdBy email instead of ObjectId
    const exportData = songs.map(song => ({
      ...song,
      createdBy: song.createdBy?.email || 'unknown@example.com'
    }));

    const outputPath = path.join(__dirname, '../songs_export.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    console.log(`✅ Exported ${songs.length} songs to ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

exportSongs();
