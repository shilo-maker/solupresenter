/**
 * One-time script to import songs from a JSON file to the production database.
 *
 * Usage: node scripts/import-songs-from-json.js <path-to-json-file>
 *
 * This will:
 * - Update existing songs (matched by title) with the new data
 * - Add new songs that don't exist
 * - Set all imported songs as public (isPublic: true)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Song } = require('../models');
const sequelize = require('../config/sequelize');

async function importSongs(jsonFilePath) {
  console.log('Starting song import from:', jsonFilePath);

  // Read the JSON file
  const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
  const songs = JSON.parse(jsonContent);

  console.log(`Found ${songs.length} songs in the JSON file`);

  let imported = 0;
  let updated = 0;
  let errors = 0;

  // Connect to database
  await sequelize.authenticate();
  console.log('Connected to database');

  // Process each song
  for (const songData of songs) {
    try {
      if (!songData.title || !songData.title.trim()) {
        console.warn('Skipping song with empty title');
        errors++;
        continue;
      }

      const title = songData.title.trim();

      // Check if song exists by title
      const existingSong = await Song.findOne({ where: { title } });

      if (existingSong) {
        // Update existing song
        await existingSong.update({
          originalLanguage: songData.originalLanguage || 'he',
          slides: songData.slides || [],
          tags: songData.tags || [],
          author: songData.author || null,
          backgroundImage: songData.backgroundImage || '',
          isPublic: true // Make sure it's public
        });
        updated++;
        console.log(`Updated: ${title}`);
      } else {
        // Create new song
        await Song.create({
          title,
          originalLanguage: songData.originalLanguage || 'he',
          slides: songData.slides || [],
          tags: songData.tags || [],
          author: songData.author || null,
          backgroundImage: songData.backgroundImage || '',
          isPublic: true
        });
        imported++;
        console.log(`Imported: ${title}`);
      }
    } catch (err) {
      console.error(`Error processing song "${songData.title}":`, err.message);
      errors++;
    }
  }

  console.log('\n========== IMPORT COMPLETE ==========');
  console.log(`New songs imported: ${imported}`);
  console.log(`Existing songs updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${imported + updated + errors}`);

  await sequelize.close();
}

// Get the JSON file path from command line argument
const jsonFilePath = process.argv[2];

if (!jsonFilePath) {
  console.error('Usage: node scripts/import-songs-from-json.js <path-to-json-file>');
  process.exit(1);
}

if (!fs.existsSync(jsonFilePath)) {
  console.error(`File not found: ${jsonFilePath}`);
  process.exit(1);
}

importSongs(jsonFilePath)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
