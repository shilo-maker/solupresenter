require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('../models/Song');

const hasHebrew = (text) => /[\u0590-\u05FF]/.test(text);

async function checkTitles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const songs = await Song.find({});
    console.log(`Total songs: ${songs.length}\n`);

    const englishOnlyTitles = [];
    const mixedTitles = [];
    const hebrewTitles = [];

    for (const song of songs) {
      if (!song.title) continue;

      if (hasHebrew(song.title)) {
        hebrewTitles.push(song.title);
      } else {
        englishOnlyTitles.push({
          id: song._id,
          title: song.title,
          firstSlideHebrew: song.slides[0]?.originalText || ''
        });
      }
    }

    console.log(`Hebrew titles: ${hebrewTitles.length}`);
    console.log(`English-only titles: ${englishOnlyTitles.length}\n`);

    console.log('Songs with English-only titles:');
    englishOnlyTitles.slice(0, 20).forEach(song => {
      console.log(`- "${song.title}"`);
      if (song.firstSlideHebrew) {
        console.log(`  First Hebrew line: ${song.firstSlideHebrew}`);
      }
    });

    if (englishOnlyTitles.length > 20) {
      console.log(`\n... and ${englishOnlyTitles.length - 20} more`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTitles();
