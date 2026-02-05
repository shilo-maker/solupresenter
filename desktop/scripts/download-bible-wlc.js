/**
 * Bible Data Download Script - Westminster Leningrad Codex Edition
 *
 * Downloads:
 * - Hebrew OT: Westminster Leningrad Codex (WLC) via wldeh/bible-api (Public Domain)
 * - Hebrew NT: Delitzsch Hebrew NT from bolls.life (Public Domain)
 * - English: World English Bible (WEB) from bolls.life (Public Domain)
 *
 * Usage: node scripts/download-bible-wlc.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'resources', 'bible-data');

// Bible books configuration
const BIBLE_BOOKS = {
  // Old Testament - WLC book names (lowercase for API)
  'Genesis': { chapters: 50, wlcName: 'genesis', bollsId: 1, testament: 'old' },
  'Exodus': { chapters: 40, wlcName: 'exodus', bollsId: 2, testament: 'old' },
  'Leviticus': { chapters: 27, wlcName: 'leviticus', bollsId: 3, testament: 'old' },
  'Numbers': { chapters: 36, wlcName: 'numbers', bollsId: 4, testament: 'old' },
  'Deuteronomy': { chapters: 34, wlcName: 'deuteronomy', bollsId: 5, testament: 'old' },
  'Joshua': { chapters: 24, wlcName: 'joshua', bollsId: 6, testament: 'old' },
  'Judges': { chapters: 21, wlcName: 'judges', bollsId: 7, testament: 'old' },
  'Ruth': { chapters: 4, wlcName: 'ruth', bollsId: 8, testament: 'old' },
  'I Samuel': { chapters: 31, wlcName: '1-samuel', bollsId: 9, testament: 'old' },
  'II Samuel': { chapters: 24, wlcName: '2-samuel', bollsId: 10, testament: 'old' },
  'I Kings': { chapters: 22, wlcName: '1-kings', bollsId: 11, testament: 'old' },
  'II Kings': { chapters: 25, wlcName: '2-kings', bollsId: 12, testament: 'old' },
  'I Chronicles': { chapters: 29, wlcName: '1-chronicles', bollsId: 13, testament: 'old' },
  'II Chronicles': { chapters: 36, wlcName: '2-chronicles', bollsId: 14, testament: 'old' },
  'Ezra': { chapters: 10, wlcName: 'ezra', bollsId: 15, testament: 'old' },
  'Nehemiah': { chapters: 13, wlcName: 'nehemiah', bollsId: 16, testament: 'old' },
  'Esther': { chapters: 10, wlcName: 'esther', bollsId: 17, testament: 'old' },
  'Job': { chapters: 42, wlcName: 'job', bollsId: 18, testament: 'old' },
  'Psalms': { chapters: 150, wlcName: 'psalms', bollsId: 19, testament: 'old' },
  'Proverbs': { chapters: 31, wlcName: 'proverbs', bollsId: 20, testament: 'old' },
  'Ecclesiastes': { chapters: 12, wlcName: 'ecclesiastes', bollsId: 21, testament: 'old' },
  'Song of Songs': { chapters: 8, wlcName: 'song-of-solomon', bollsId: 22, testament: 'old' },
  'Isaiah': { chapters: 66, wlcName: 'isaiah', bollsId: 23, testament: 'old' },
  'Jeremiah': { chapters: 52, wlcName: 'jeremiah', bollsId: 24, testament: 'old' },
  'Lamentations': { chapters: 5, wlcName: 'lamentations', bollsId: 25, testament: 'old' },
  'Ezekiel': { chapters: 48, wlcName: 'ezekiel', bollsId: 26, testament: 'old' },
  'Daniel': { chapters: 12, wlcName: 'daniel', bollsId: 27, testament: 'old' },
  'Hosea': { chapters: 14, wlcName: 'hosea', bollsId: 28, testament: 'old' },
  'Joel': { chapters: 3, wlcName: 'joel', bollsId: 29, testament: 'old' },
  'Amos': { chapters: 9, wlcName: 'amos', bollsId: 30, testament: 'old' },
  'Obadiah': { chapters: 1, wlcName: 'obadiah', bollsId: 31, testament: 'old' },
  'Jonah': { chapters: 4, wlcName: 'jonah', bollsId: 32, testament: 'old' },
  'Micah': { chapters: 7, wlcName: 'micah', bollsId: 33, testament: 'old' },
  'Nahum': { chapters: 3, wlcName: 'nahum', bollsId: 34, testament: 'old' },
  'Habakkuk': { chapters: 3, wlcName: 'habakkuk', bollsId: 35, testament: 'old' },
  'Zephaniah': { chapters: 3, wlcName: 'zephaniah', bollsId: 36, testament: 'old' },
  'Haggai': { chapters: 2, wlcName: 'haggai', bollsId: 37, testament: 'old' },
  'Zechariah': { chapters: 14, wlcName: 'zechariah', bollsId: 38, testament: 'old' },
  'Malachi': { chapters: 4, wlcName: 'malachi', bollsId: 39, testament: 'old' },
  // New Testament - bolls.life only (Hebrew NT from Delitzsch)
  'Matthew': { chapters: 28, bollsId: 40, testament: 'new' },
  'Mark': { chapters: 16, bollsId: 41, testament: 'new' },
  'Luke': { chapters: 24, bollsId: 42, testament: 'new' },
  'John': { chapters: 21, bollsId: 43, testament: 'new' },
  'Acts': { chapters: 28, bollsId: 44, testament: 'new' },
  'Romans': { chapters: 16, bollsId: 45, testament: 'new' },
  '1 Corinthians': { chapters: 16, bollsId: 46, testament: 'new' },
  '2 Corinthians': { chapters: 13, bollsId: 47, testament: 'new' },
  'Galatians': { chapters: 6, bollsId: 48, testament: 'new' },
  'Ephesians': { chapters: 6, bollsId: 49, testament: 'new' },
  'Philippians': { chapters: 4, bollsId: 50, testament: 'new' },
  'Colossians': { chapters: 4, bollsId: 51, testament: 'new' },
  '1 Thessalonians': { chapters: 5, bollsId: 52, testament: 'new' },
  '2 Thessalonians': { chapters: 3, bollsId: 53, testament: 'new' },
  '1 Timothy': { chapters: 6, bollsId: 54, testament: 'new' },
  '2 Timothy': { chapters: 4, bollsId: 55, testament: 'new' },
  'Titus': { chapters: 3, bollsId: 56, testament: 'new' },
  'Philemon': { chapters: 1, bollsId: 57, testament: 'new' },
  'Hebrews': { chapters: 13, bollsId: 58, testament: 'new' },
  'James': { chapters: 5, bollsId: 59, testament: 'new' },
  '1 Peter': { chapters: 5, bollsId: 60, testament: 'new' },
  '2 Peter': { chapters: 3, bollsId: 61, testament: 'new' },
  '1 John': { chapters: 5, bollsId: 62, testament: 'new' },
  '2 John': { chapters: 1, bollsId: 63, testament: 'new' },
  '3 John': { chapters: 1, bollsId: 64, testament: 'new' },
  'Jude': { chapters: 1, bollsId: 65, testament: 'new' },
  'Revelation': { chapters: 22, bollsId: 66, testament: 'new' }
};

// Hebrew names for books
const HEBREW_BOOK_NAMES = {
  'Genesis': 'בראשית',
  'Exodus': 'שמות',
  'Leviticus': 'ויקרא',
  'Numbers': 'במדבר',
  'Deuteronomy': 'דברים',
  'Joshua': 'יהושע',
  'Judges': 'שופטים',
  'Ruth': 'רות',
  'I Samuel': 'שמואל א',
  'II Samuel': 'שמואל ב',
  'I Kings': 'מלכים א',
  'II Kings': 'מלכים ב',
  'I Chronicles': 'דברי הימים א',
  'II Chronicles': 'דברי הימים ב',
  'Ezra': 'עזרא',
  'Nehemiah': 'נחמיה',
  'Esther': 'אסתר',
  'Job': 'איוב',
  'Psalms': 'תהילים',
  'Proverbs': 'משלי',
  'Ecclesiastes': 'קהלת',
  'Song of Songs': 'שיר השירים',
  'Isaiah': 'ישעיהו',
  'Jeremiah': 'ירמיהו',
  'Lamentations': 'איכה',
  'Ezekiel': 'יחזקאל',
  'Daniel': 'דניאל',
  'Hosea': 'הושע',
  'Joel': 'יואל',
  'Amos': 'עמוס',
  'Obadiah': 'עובדיה',
  'Jonah': 'יונה',
  'Micah': 'מיכה',
  'Nahum': 'נחום',
  'Habakkuk': 'חבקוק',
  'Zephaniah': 'צפניה',
  'Haggai': 'חגי',
  'Zechariah': 'זכריה',
  'Malachi': 'מלאכי',
  // New Testament Hebrew names
  'Matthew': 'מתי',
  'Mark': 'מרקוס',
  'Luke': 'לוקס',
  'John': 'יוחנן',
  'Acts': 'מעשי השליחים',
  'Romans': 'אל הרומים',
  '1 Corinthians': 'אל הקורינתים א',
  '2 Corinthians': 'אל הקורינתים ב',
  'Galatians': 'אל הגלטים',
  'Ephesians': 'אל האפסים',
  'Philippians': 'אל הפיליפים',
  'Colossians': 'אל הקולוסים',
  '1 Thessalonians': 'אל התסלוניקים א',
  '2 Thessalonians': 'אל התסלוניקים ב',
  '1 Timothy': 'אל טימותיוס א',
  '2 Timothy': 'אל טימותיוס ב',
  'Titus': 'אל טיטוס',
  'Philemon': 'אל פילימון',
  'Hebrews': 'אל העברים',
  'James': 'יעקב',
  '1 Peter': 'פטרוס א',
  '2 Peter': 'פטרוס ב',
  '1 John': 'יוחנן א',
  '2 John': 'יוחנן ב',
  '3 John': 'יוחנן ג',
  'Jude': 'יהודה',
  'Revelation': 'התגלות'
};

// Utility: Make HTTPS request
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Utility: Sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch Hebrew OT verse from Westminster Leningrad Codex via Bible API
async function fetchWLCVerse(bookName, chapter, verse) {
  const url = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/he-wlc/books/${bookName}/chapters/${chapter}/verses/${verse}.json`;
  try {
    const data = await httpsGet(url);
    return data.text || '';
  } catch (e) {
    // Try alternate URL pattern
    try {
      const altUrl = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/hbo-wlc/books/${bookName}/chapters/${chapter}/verses/${verse}.json`;
      const data = await httpsGet(altUrl);
      return data.text || '';
    } catch (e2) {
      console.error(`  Error fetching WLC ${bookName} ${chapter}:${verse}:`, e.message);
      return '';
    }
  }
}

// Fetch entire chapter from WLC
async function fetchWLCChapter(bookName, chapter, expectedVerses) {
  const verses = [];
  // First try to get the chapter file directly
  const chapterUrl = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/he-wlc/books/${bookName}/chapters/${chapter}.json`;
  try {
    const data = await httpsGet(chapterUrl);
    if (data.verses && Array.isArray(data.verses)) {
      return data.verses.map(v => v.text || '');
    }
  } catch (e) {
    // Fall back to verse-by-verse fetching
  }

  // Fetch verse by verse
  for (let v = 1; v <= expectedVerses + 10; v++) { // Extra buffer for verse count variations
    const text = await fetchWLCVerse(bookName, chapter, v);
    if (!text && v > expectedVerses) break; // Stop if we've gone past expected and hit empty
    verses.push(text);
    await sleep(50); // Rate limiting
  }
  return verses.filter(v => v); // Remove empty trailing verses
}

// Fetch English text from bolls.life (WEB translation)
async function fetchBollsChapter(bookId, chapter) {
  const url = `https://bolls.life/get-chapter/WEB/${bookId}/${chapter}/`;
  try {
    const data = await httpsGet(url);
    if (Array.isArray(data)) {
      return data.map(v => ({
        verse: v.verse,
        text: v.text
      }));
    }
    return [];
  } catch (e) {
    console.error(`  Error fetching bolls.life book ${bookId} chapter ${chapter}:`, e.message);
    return [];
  }
}

// Fetch Hebrew NT from bolls.life (Delitzsch Hebrew New Testament)
async function fetchHebrewNTChapter(bookId, chapter) {
  const url = `https://bolls.life/get-chapter/DHNT/${bookId}/${chapter}/`;
  try {
    const data = await httpsGet(url);
    if (Array.isArray(data)) {
      return data.map(v => ({
        verse: v.verse,
        text: v.text
      }));
    }
    return [];
  } catch (e) {
    console.error(`  Error fetching Hebrew NT book ${bookId} chapter ${chapter}:`, e.message);
    return [];
  }
}

// Main download function
async function downloadBibleData() {
  console.log('=== Bible Data Download Script (WLC Edition) ===\n');
  console.log('Sources:');
  console.log('  Hebrew OT: Westminster Leningrad Codex (Public Domain)');
  console.log('  Hebrew NT: Delitzsch Hebrew NT (Public Domain)');
  console.log('  English:   World English Bible (Public Domain)\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allVerses = [];
  const bookNames = Object.keys(BIBLE_BOOKS);
  let bookNumber = 1;
  let totalOTVerses = 0;
  let totalNTVerses = 0;

  for (const bookName of bookNames) {
    const bookConfig = BIBLE_BOOKS[bookName];
    console.log(`\nProcessing ${bookName} (${bookConfig.chapters} chapters)...`);

    for (let chapter = 1; chapter <= bookConfig.chapters; chapter++) {
      process.stdout.write(`  Chapter ${chapter}/${bookConfig.chapters}...\r`);

      // Fetch English (WEB)
      const englishVerses = await fetchBollsChapter(bookConfig.bollsId, chapter);
      await sleep(100); // Rate limiting

      // Fetch Hebrew
      let hebrewVerses = [];
      if (bookConfig.testament === 'old' && bookConfig.wlcName) {
        // Old Testament - use Westminster Leningrad Codex
        hebrewVerses = await fetchWLCChapter(bookConfig.wlcName, chapter, englishVerses.length);
        await sleep(100);
      } else if (bookConfig.testament === 'new') {
        // New Testament - use DHNT from bolls.life
        const hebrewNT = await fetchHebrewNTChapter(bookConfig.bollsId, chapter);
        hebrewVerses = hebrewNT.map(v => v.text);
        await sleep(100);
      }

      // Combine verses
      const maxVerses = Math.max(englishVerses.length, hebrewVerses.length);
      for (let v = 0; v < maxVerses; v++) {
        allVerses.push({
          book: bookName,
          bookNumber: bookNumber,
          testament: bookConfig.testament,
          chapter: chapter,
          verse: v + 1,
          hebrewText: hebrewVerses[v] || '',
          englishText: englishVerses[v]?.text || ''
        });

        if (bookConfig.testament === 'old') totalOTVerses++;
        else totalNTVerses++;
      }
    }

    console.log(`  Done - ${bookConfig.chapters} chapters processed`);
    bookNumber++;
  }

  // Save to JSON file
  const outputFile = path.join(OUTPUT_DIR, 'bible-complete.json');
  fs.writeFileSync(outputFile, JSON.stringify({
    version: '2.0',
    hebrewOTSource: 'Westminster Leningrad Codex (WLC) - Public Domain',
    hebrewNTSource: 'Delitzsch Hebrew New Testament - Public Domain',
    englishSource: 'World English Bible (WEB) - Public Domain',
    generatedAt: new Date().toISOString(),
    books: HEBREW_BOOK_NAMES,
    totalVerses: allVerses.length,
    otVerses: totalOTVerses,
    ntVerses: totalNTVerses,
    verses: allVerses
  }, null, 2));

  console.log(`\n=== Download Complete ===`);
  console.log(`Total verses: ${allVerses.length}`);
  console.log(`  OT verses: ${totalOTVerses}`);
  console.log(`  NT verses: ${totalNTVerses}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
}

// Run
downloadBibleData().catch(err => {
  console.error('Download failed:', err);
  process.exit(1);
});
