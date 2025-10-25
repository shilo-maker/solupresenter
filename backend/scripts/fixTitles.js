require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Song = require('../models/Song');

const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);
const extractHebrew = (text) => {
  // Try to extract Hebrew portion from mixed text
  const hebrewMatch = text.match(/[\u0590-\u05FF]+(?:\s+[\u0590-\u05FF]+)*/);
  return hebrewMatch ? hebrewMatch[0] : null;
};

async function fixTitles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const songs = await Song.find({});
    const songsImportDir = path.join(__dirname, '../../import_new');
    const files = fs.readdirSync(songsImportDir).filter(file => file.endsWith('.txt'));

    let updatedCount = 0;

    for (const song of songs) {
      if (!song.title || hasHebrew(song.title)) {
        continue; // Skip if already has Hebrew
      }

      let newTitle = null;

      // Strategy 1: Find the matching file and check if filename has Hebrew
      const matchingFile = files.find(f => {
        try {
          const fileContent = fs.readFileSync(path.join(songsImportDir, f), 'utf8');
          const lines = fileContent.split('\n').map(line => line.trim());
          if (lines[0] && lines[0].startsWith('Title:')) {
            const fileTitle = lines[0].substring(6).trim();
            return fileTitle === song.title;
          }
        } catch (e) {
          return false;
        }
        return false;
      });

      if (matchingFile) {
        const filename = path.basename(matchingFile, '.txt');
        const hebrewFromFilename = extractHebrew(filename);

        if (hebrewFromFilename) {
          newTitle = hebrewFromFilename;
        }
      }

      // Strategy 2: If no Hebrew in filename, use first 3-4 words of first Hebrew line
      if (!newTitle && song.slides.length > 0 && song.slides[0].originalText) {
        const firstHebrew = song.slides[0].originalText;
        const words = firstHebrew.split(/\s+/).filter(w => w.length > 0).slice(0, 4).join(' ');
        if (words) {
          newTitle = words;
        }
      }

      if (newTitle) {
        console.log(`Updating: "${song.title}" -> "${newTitle}"`);
        song.title = newTitle;
        await song.save();
        updatedCount++;
      }
    }

    console.log(`\n✅ Updated ${updatedCount} song titles to Hebrew`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixTitles();
