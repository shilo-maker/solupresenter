require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Song = require('../models/Song');
const User = require('../models/User');

async function importSong(filePath) {
  try {
    // Read the file
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').map(line => line.trim());

    // Use Hebrew filename as title (remove .txt extension)
    const filename = path.basename(filePath);
    const title = filename.replace('.txt', '');

    console.log(`\nImporting song: ${title}`);

    // Parse slides
    const slides = [];
    let i = 0; // Start from beginning

    // Skip the Title: line and any empty lines after it
    while (i < lines.length && (lines[i] === '' || lines[i].startsWith('Title:'))) {
      i++;
    }

    while (i < lines.length) {
      // Skip empty lines
      while (i < lines.length && lines[i] === '') {
        i++;
      }

      if (i >= lines.length) break;

      // Read Hebrew line (originalText)
      const originalText = lines[i];
      if (!originalText) break;
      i++;

      // Skip empty line
      while (i < lines.length && lines[i] === '') {
        i++;
      }

      // Read transliteration line
      const transliteration = lines[i] || '';
      i++;

      // Skip empty line
      while (i < lines.length && lines[i] === '') {
        i++;
      }

      // Read translation line(s)
      let translation = '';
      let translationOverflow = '';

      if (i < lines.length && lines[i]) {
        translation = lines[i];
        i++;

        // Check if next non-empty line is part of translation (not Hebrew)
        while (i < lines.length && lines[i] === '') {
          i++;
        }

        // If the next line exists and doesn't look like Hebrew (no Hebrew characters), it's overflow
        if (i < lines.length && lines[i]) {
          const nextLine = lines[i];
          // Check if line contains Hebrew characters
          const hasHebrew = /[\u0590-\u05FF]/.test(nextLine);

          if (!hasHebrew && nextLine) {
            translationOverflow = nextLine;
            i++;
          }
        }
      }

      // Add slide
      if (originalText) {
        slides.push({
          originalText,
          transliteration,
          translation,
          translationOverflow
        });
      }
    }

    console.log(`Parsed ${slides.length} slides`);

    return {
      title,
      slides,
      originalLanguage: 'he', // Hebrew
      tags: []
    };
  } catch (error) {
    console.error('Error parsing song file:', error);
    throw error;
  }
}

async function importAllSongs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('No admin user found. Please create an admin first.');
      process.exit(1);
    }

    console.log(`Importing songs as user: ${admin.email}`);

    // Get all .txt files from songs_import folder
    const songsImportDir = path.join(__dirname, '../../songs_import');
    const files = fs.readdirSync(songsImportDir).filter(file => file.endsWith('.txt'));

    console.log(`Found ${files.length} song file(s) to import\n`);

    for (const file of files) {
      const filePath = path.join(songsImportDir, file);

      try {
        const songData = await importSong(filePath);

        // Check if song already exists
        const existingSong = await Song.findOne({ title: songData.title });
        if (existingSong) {
          console.log(`⚠️  Song "${songData.title}" already exists, skipping...`);
          continue;
        }

        // Create song in database
        const song = await Song.create({
          ...songData,
          createdBy: admin._id,
          isPublic: true,
          isPendingApproval: false
        });

        console.log(`✅ Imported: "${song.title}" with ${song.slides.length} slides`);

        // Display first slide as sample
        if (song.slides.length > 0) {
          console.log('   First slide:');
          console.log(`   - Hebrew: ${song.slides[0].originalText}`);
          console.log(`   - Transliteration: ${song.slides[0].transliteration}`);
          console.log(`   - Translation: ${song.slides[0].translation}`);
          if (song.slides[0].translationOverflow) {
            console.log(`   - Overflow: ${song.slides[0].translationOverflow}`);
          }
        }
        console.log('');

      } catch (error) {
        console.error(`❌ Failed to import "${file}":`, error.message);
      }
    }

    console.log('\n✨ Import complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error importing songs:', error);
    process.exit(1);
  }
}

importAllSongs();
