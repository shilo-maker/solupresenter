/**
 * Build Translation Dictionary from Existing Songs
 *
 * Extracts Hebrew-to-English translation pairs from all songs.
 * Uses both line-level and word-level mappings.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sequelize = require('../config/sequelize');
const Song = require('../models/Song');
const fs = require('fs');
const path = require('path');

// Hebrew character detection regex
const HEBREW_REGEX = /[\u0590-\u05FF]/;

// Punctuation to remove for word matching
const PUNCTUATION = /[.,!?;:'"()[\]{}\-–—!]/g;

function normalizeWord(word) {
  return word.replace(PUNCTUATION, '').trim().toLowerCase();
}

function normalizeHebrew(word) {
  return word.replace(PUNCTUATION, '').trim();
}

function isHebrew(text) {
  return HEBREW_REGEX.test(text);
}

async function buildTranslationDictionary() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const songs = await Song.findAll({
      attributes: ['id', 'title', 'slides']
    });

    console.log(`📚 Found ${songs.length} songs`);

    // Line-level dictionary: full Hebrew line -> full English translation
    const lineDictionary = {};

    // Word-level dictionary: Hebrew word -> {translations: {word: count}}
    const wordDictionary = {};

    let totalLines = 0;
    let matchedWordLines = 0;

    for (const song of songs) {
      const slides = song.slides || [];

      for (const slide of slides) {
        const hebrew = slide.originalText;
        const translation = slide.translation;

        if (!hebrew || !translation) continue;
        if (!isHebrew(hebrew)) continue;

        totalLines++;

        // Store full line translation
        const hebrewNorm = hebrew.trim();
        if (!lineDictionary[hebrewNorm]) {
          lineDictionary[hebrewNorm] = translation.trim();
        }

        // Try word-level extraction
        const hebrewWords = hebrew.split(/\s+/).filter(w => w.length > 0);
        const englishWords = translation.split(/\s+/).filter(w => w.length > 0);

        // Only extract word-level if word counts are similar (within 1)
        if (Math.abs(hebrewWords.length - englishWords.length) <= 1 && hebrewWords.length <= 4) {
          matchedWordLines++;

          // For short lines with same word count, try 1:1 mapping
          if (hebrewWords.length === englishWords.length) {
            for (let i = 0; i < hebrewWords.length; i++) {
              const heb = normalizeHebrew(hebrewWords[i]);
              const eng = normalizeWord(englishWords[i]);

              if (heb && eng && isHebrew(heb)) {
                if (!wordDictionary[heb]) {
                  wordDictionary[heb] = {};
                }
                wordDictionary[heb][eng] = (wordDictionary[heb][eng] || 0) + 1;
              }
            }
          }
        }
      }
    }

    // Build final word dictionary - pick most common translation for each word
    const finalWordDict = {};
    for (const [hebrew, translations] of Object.entries(wordDictionary)) {
      // Sort by count and pick the most common
      const sorted = Object.entries(translations).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0 && sorted[0][1] >= 2) {
        // Only include if seen at least twice
        finalWordDict[hebrew] = sorted[0][0];
      }
    }

    // Statistics
    console.log('\n📊 Statistics:');
    console.log(`   Total lines processed: ${totalLines}`);
    console.log(`   Lines with word-level match: ${matchedWordLines}`);
    console.log(`   Line-level translations: ${Object.keys(lineDictionary).length}`);
    console.log(`   Word-level translations: ${Object.keys(finalWordDict).length}`);

    // Show some word examples
    console.log('\n📝 Sample word translations:');
    const samples = Object.entries(finalWordDict).slice(0, 15);
    for (const [hebrew, english] of samples) {
      console.log(`   ${hebrew} → ${english}`);
    }

    // Save line dictionary
    const linePath = path.join(__dirname, 'hebrew-translation-lines.json');
    fs.writeFileSync(linePath, JSON.stringify(lineDictionary, null, 2), 'utf-8');
    console.log(`\n💾 Line dictionary saved to: ${linePath}`);
    console.log(`   File size: ${(fs.statSync(linePath).size / 1024).toFixed(1)} KB`);

    // Save word dictionary
    const wordPath = path.join(__dirname, 'hebrew-translation-words.json');
    fs.writeFileSync(wordPath, JSON.stringify(finalWordDict, null, 2), 'utf-8');
    console.log(`💾 Word dictionary saved to: ${wordPath}`);
    console.log(`   File size: ${(fs.statSync(wordPath).size / 1024).toFixed(1)} KB`);

    return { lineDictionary, wordDictionary: finalWordDict };

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  buildTranslationDictionary()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { buildTranslationDictionary };
