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

    console.log(`\nImporting song: ${path.basename(filePath)}`);

    // Extract title from first line: "Title: [song title]"
    let title = path.basename(filePath).replace('.txt', ''); // Default to filename
    let i = 0;

    if (lines[i] && lines[i].startsWith('Title:')) {
      title = lines[i].substring(6).trim(); // Extract title after "Title: "
      i++;
    }

    console.log(`Song title: ${title}`);

    // Skip empty lines after title
    while (i < lines.length && lines[i] === '') {
      i++;
    }

    // Parse slides using the correct pattern:
    // 1. Find next Hebrew line (skip if not Hebrew)
    // 2. Next line of text = transliteration
    // 3. Empty line
    // 4. 1 or 2 consecutive lines = translation (+ optional overflow)
    // 5. Empty line, then repeat
    const slides = [];
    const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

    while (i < lines.length) {
      // Skip empty lines
      while (i < lines.length && lines[i] === '') {
        i++;
      }

      if (i >= lines.length) break;

      // Step 1: Find next Hebrew line
      let originalText = '';
      while (i < lines.length && lines[i]) {
        if (hasHebrew(lines[i])) {
          originalText = lines[i];
          i++;
          break;
        }
        // Skip non-Hebrew lines
        i++;
      }

      if (!originalText) break; // No more Hebrew lines found

      // Step 2: Read transliteration (next non-empty line)
      while (i < lines.length && lines[i] === '') {
        i++;
      }

      let transliteration = '';
      if (i < lines.length && lines[i]) {
        transliteration = lines[i];
        i++;
      }

      // Step 3: Skip empty line(s) before translation
      while (i < lines.length && lines[i] === '') {
        i++;
      }

      // Step 4: Read translation (1 or 2 consecutive lines)
      let translation = '';
      let translationOverflow = '';

      if (i < lines.length && lines[i]) {
        translation = lines[i];
        i++;

        // Check if next line (without empty line in between) is also translation overflow
        if (i < lines.length && lines[i] && !hasHebrew(lines[i])) {
          translationOverflow = lines[i];
          i++;
        }
      }

      // Add slide
      slides.push({
        originalText,
        transliteration,
        translation,
        translationOverflow
      });

      // Step 5: Empty line should follow, and loop repeats
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

    // Get all .txt files from import_new folder
    const songsImportDir = path.join(__dirname, '../../import_new');
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
