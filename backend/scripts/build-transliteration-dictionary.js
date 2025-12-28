/**
 * Build Transliteration Dictionary from Existing Songs
 *
 * This script extracts Hebrew-to-transliteration word pairs from all songs
 * in the database and builds a lookup dictionary for the Quick Slide feature.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sequelize = require('../config/sequelize');
const Song = require('../models/Song');

// Hebrew character detection regex
const HEBREW_REGEX = /[\u0590-\u05FF]/;

// Punctuation to remove for word matching
const PUNCTUATION = /[.,!?;:'"()[\]{}\-–—]/g;

/**
 * Normalize a word for dictionary lookup
 * Removes punctuation and extra whitespace
 */
function normalizeWord(word) {
  return word.replace(PUNCTUATION, '').trim();
}

/**
 * Check if a string contains Hebrew characters
 */
function isHebrew(text) {
  return HEBREW_REGEX.test(text);
}

/**
 * Extract word pairs from a Hebrew line and its transliteration
 * Returns array of {hebrew, transliteration} objects
 */
function extractWordPairs(hebrewLine, translitLine) {
  if (!hebrewLine || !translitLine) return [];

  // Split into words (Hebrew is RTL but stored LTR in string)
  const hebrewWords = hebrewLine.split(/\s+/).filter(w => w.length > 0);
  const translitWords = translitLine.split(/\s+/).filter(w => w.length > 0);

  const pairs = [];

  // Try to match words by position
  // Note: Hebrew words and transliteration should have same count
  if (hebrewWords.length === translitWords.length) {
    for (let i = 0; i < hebrewWords.length; i++) {
      const hebrew = normalizeWord(hebrewWords[i]);
      const translit = normalizeWord(translitWords[i]);

      if (hebrew && translit && isHebrew(hebrew)) {
        pairs.push({ hebrew, translit });
      }
    }
  }

  return pairs;
}

/**
 * Build dictionary from all songs
 */
async function buildDictionary() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Fetch all songs with slides
    const songs = await Song.findAll({
      attributes: ['id', 'title', 'slides']
    });

    console.log(`📚 Found ${songs.length} songs`);

    // Dictionary: hebrew word -> {translit, count, examples}
    const dictionary = {};
    let totalPairs = 0;
    let matchedLines = 0;
    let unmatchedLines = 0;

    for (const song of songs) {
      const slides = song.slides || [];

      for (const slide of slides) {
        const hebrew = slide.originalText;
        const translit = slide.transliteration;

        if (!hebrew || !translit) continue;
        if (!isHebrew(hebrew)) continue;

        const pairs = extractWordPairs(hebrew, translit);

        if (pairs.length > 0) {
          matchedLines++;

          for (const { hebrew: heb, translit: trans } of pairs) {
            if (!dictionary[heb]) {
              dictionary[heb] = {
                translit: trans,
                count: 1,
                variants: [trans]
              };
            } else {
              dictionary[heb].count++;
              // Track variants (different transliterations for same Hebrew word)
              if (!dictionary[heb].variants.includes(trans)) {
                dictionary[heb].variants.push(trans);
              }
            }
            totalPairs++;
          }
        } else if (hebrew && translit) {
          unmatchedLines++;
        }
      }
    }

    // Build final dictionary (just hebrew -> translit for simplicity)
    const finalDict = {};
    for (const [hebrew, data] of Object.entries(dictionary)) {
      // Use most common variant (first one seen, or could sort by frequency)
      finalDict[hebrew] = data.translit;
    }

    // Statistics
    console.log('\n📊 Statistics:');
    console.log(`   Total word pairs extracted: ${totalPairs}`);
    console.log(`   Unique Hebrew words: ${Object.keys(dictionary).length}`);
    console.log(`   Lines with word-by-word match: ${matchedLines}`);
    console.log(`   Lines with word count mismatch: ${unmatchedLines}`);

    // Show some examples
    console.log('\n📝 Sample entries:');
    const samples = Object.entries(finalDict).slice(0, 10);
    for (const [hebrew, translit] of samples) {
      console.log(`   ${hebrew} → ${translit}`);
    }

    // Show words with multiple variants
    const multiVariant = Object.entries(dictionary)
      .filter(([_, data]) => data.variants.length > 1)
      .slice(0, 5);

    if (multiVariant.length > 0) {
      console.log('\n🔄 Words with transliteration variants:');
      for (const [hebrew, data] of multiVariant) {
        console.log(`   ${hebrew} → ${data.variants.join(', ')}`);
      }
    }

    // Save to JSON file
    const fs = require('fs');
    const outputPath = require('path').join(__dirname, 'hebrew-transliteration-dict.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalDict, null, 2), 'utf-8');
    console.log(`\n💾 Dictionary saved to: ${outputPath}`);
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);

    // Also save extended dictionary with stats
    const extendedPath = require('path').join(__dirname, 'hebrew-transliteration-dict-extended.json');
    fs.writeFileSync(extendedPath, JSON.stringify(dictionary, null, 2), 'utf-8');
    console.log(`   Extended dict (with variants): ${extendedPath}`);

    return finalDict;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  buildDictionary()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { buildDictionary, extractWordPairs, normalizeWord };
