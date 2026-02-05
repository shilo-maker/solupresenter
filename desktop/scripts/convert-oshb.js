/**
 * OSHB to JSON Converter
 *
 * Converts OpenScriptures Hebrew Bible (OSHB) XML files to our JSON format.
 * Uses Westminster Leningrad Codex (WLC) text - Public Domain.
 *
 * Usage: node scripts/convert-oshb.js
 */

const fs = require('fs');
const path = require('path');

// OSHB source directory
const OSHB_DIR = path.join('C:', 'Users', 'shilo', 'Downloads', 'OSHB-v.2.0', 'OSHB-v.2.0');
const OUTPUT_DIR = path.join(__dirname, '..', 'resources', 'bible-data');

// Book mapping: OSHB filename -> our book name
const OSHB_BOOKS = {
  'Gen': { name: 'Genesis', number: 1 },
  'Exod': { name: 'Exodus', number: 2 },
  'Lev': { name: 'Leviticus', number: 3 },
  'Num': { name: 'Numbers', number: 4 },
  'Deut': { name: 'Deuteronomy', number: 5 },
  'Josh': { name: 'Joshua', number: 6 },
  'Judg': { name: 'Judges', number: 7 },
  'Ruth': { name: 'Ruth', number: 8 },
  '1Sam': { name: 'I Samuel', number: 9 },
  '2Sam': { name: 'II Samuel', number: 10 },
  '1Kgs': { name: 'I Kings', number: 11 },
  '2Kgs': { name: 'II Kings', number: 12 },
  '1Chr': { name: 'I Chronicles', number: 13 },
  '2Chr': { name: 'II Chronicles', number: 14 },
  'Ezra': { name: 'Ezra', number: 15 },
  'Neh': { name: 'Nehemiah', number: 16 },
  'Esth': { name: 'Esther', number: 17 },
  'Job': { name: 'Job', number: 18 },
  'Ps': { name: 'Psalms', number: 19 },
  'Prov': { name: 'Proverbs', number: 20 },
  'Eccl': { name: 'Ecclesiastes', number: 21 },
  'Song': { name: 'Song of Songs', number: 22 },
  'Isa': { name: 'Isaiah', number: 23 },
  'Jer': { name: 'Jeremiah', number: 24 },
  'Lam': { name: 'Lamentations', number: 25 },
  'Ezek': { name: 'Ezekiel', number: 26 },
  'Dan': { name: 'Daniel', number: 27 },
  'Hos': { name: 'Hosea', number: 28 },
  'Joel': { name: 'Joel', number: 29 },
  'Amos': { name: 'Amos', number: 30 },
  'Obad': { name: 'Obadiah', number: 31 },
  'Jonah': { name: 'Jonah', number: 32 },
  'Mic': { name: 'Micah', number: 33 },
  'Nah': { name: 'Nahum', number: 34 },
  'Hab': { name: 'Habakkuk', number: 35 },
  'Zeph': { name: 'Zephaniah', number: 36 },
  'Hag': { name: 'Haggai', number: 37 },
  'Zech': { name: 'Zechariah', number: 38 },
  'Mal': { name: 'Malachi', number: 39 }
};

// Hebrew book names
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
  'Malachi': 'מלאכי'
};

/**
 * Parse OSHB XML and extract verses
 */
function parseOSHBFile(xmlContent, bookInfo) {
  const verses = [];

  // Match all verse elements
  const verseRegex = /<verse osisID="([^"]+)">([\s\S]*?)<\/verse>/g;
  let match;

  while ((match = verseRegex.exec(xmlContent)) !== null) {
    const osisId = match[1]; // e.g., "Gen.1.1"
    const verseContent = match[2];

    // Parse osisID to get chapter and verse
    const parts = osisId.split('.');
    const chapter = parseInt(parts[1], 10);
    const verseNum = parseInt(parts[2], 10);

    // Extract Hebrew text from <w> elements
    // The text is between > and < but may have / for morpheme boundaries
    const wordRegex = /<w[^>]*>([^<]+)<\/w>/g;
    const words = [];
    let wordMatch;

    while ((wordMatch = wordRegex.exec(verseContent)) !== null) {
      // Get the word text, removing morpheme boundary markers (/)
      let word = wordMatch[1].replace(/\//g, '');
      words.push(word);
    }

    // Also capture sof pasuq and other segments
    const segRegex = /<seg[^>]*>([^<]+)<\/seg>/g;
    let segMatch;
    while ((segMatch = segRegex.exec(verseContent)) !== null) {
      // Don't add space before sof pasuq
      if (words.length > 0) {
        words[words.length - 1] += segMatch[1];
      }
    }

    const hebrewText = words.join(' ').trim();

    verses.push({
      book: bookInfo.name,
      bookNumber: bookInfo.number,
      testament: 'old',
      chapter,
      verse: verseNum,
      hebrewText,
      englishText: '' // Will be filled later from existing data
    });
  }

  return verses;
}

/**
 * Load existing Bible data to get English text
 */
function loadExistingBibleData() {
  const existingFile = path.join(OUTPUT_DIR, 'bible-complete.json');
  if (fs.existsSync(existingFile)) {
    console.log('Loading existing Bible data for English text...');
    const data = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    return data.verses;
  }
  return [];
}

/**
 * Main conversion function
 */
async function convertOSHB() {
  console.log('=== OSHB to JSON Converter ===\n');
  console.log(`Source: ${OSHB_DIR}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Check if OSHB directory exists
  if (!fs.existsSync(OSHB_DIR)) {
    console.error(`Error: OSHB directory not found: ${OSHB_DIR}`);
    process.exit(1);
  }

  // Load existing data for English text
  const existingVerses = loadExistingBibleData();
  const englishMap = new Map();
  for (const v of existingVerses) {
    const key = `${v.book}|${v.chapter}|${v.verse}`;
    englishMap.set(key, v.englishText);
  }
  console.log(`Loaded ${englishMap.size} English verses from existing data.\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allVerses = [];

  // Process each OSHB book file in order
  const sortedBooks = Object.entries(OSHB_BOOKS).sort((a, b) => a[1].number - b[1].number);

  for (const [oshbName, bookInfo] of sortedBooks) {
    const xmlFile = path.join(OSHB_DIR, `${oshbName}.xml`);

    if (!fs.existsSync(xmlFile)) {
      console.warn(`Warning: File not found: ${xmlFile}`);
      continue;
    }

    console.log(`Processing ${bookInfo.name}...`);

    const xmlContent = fs.readFileSync(xmlFile, 'utf8');
    const verses = parseOSHBFile(xmlContent, bookInfo);

    // Add English text from existing data
    for (const verse of verses) {
      const key = `${verse.book}|${verse.chapter}|${verse.verse}`;
      verse.englishText = englishMap.get(key) || '';
    }

    allVerses.push(...verses);
    console.log(`  ${verses.length} verses extracted`);
  }

  // Now we need NT data - load from existing file
  console.log('\nAdding New Testament from existing data...');
  const ntVerses = existingVerses.filter(v => v.testament === 'new');
  allVerses.push(...ntVerses);
  console.log(`  ${ntVerses.length} NT verses added`);

  // Prepare final output
  const hebrewBookNames = { ...HEBREW_BOOK_NAMES };
  // Add NT Hebrew names from existing data
  const existingData = fs.existsSync(path.join(OUTPUT_DIR, 'bible-complete.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'bible-complete.json'), 'utf8'))
    : { books: {} };

  for (const [eng, heb] of Object.entries(existingData.books || {})) {
    if (!hebrewBookNames[eng]) {
      hebrewBookNames[eng] = heb;
    }
  }

  // Count stats
  const otVerses = allVerses.filter(v => v.testament === 'old').length;
  const ntVersesCount = allVerses.filter(v => v.testament === 'new').length;
  const versesWithHebrew = allVerses.filter(v => v.hebrewText).length;
  const versesWithEnglish = allVerses.filter(v => v.englishText).length;

  // Save output
  const outputFile = path.join(OUTPUT_DIR, 'bible-complete.json');

  // Backup existing file
  if (fs.existsSync(outputFile)) {
    const backupFile = path.join(OUTPUT_DIR, 'bible-complete-backup.json');
    fs.copyFileSync(outputFile, backupFile);
    console.log(`\nBacked up existing file to ${backupFile}`);
  }

  fs.writeFileSync(outputFile, JSON.stringify({
    version: '2.0',
    hebrewOTSource: 'OpenScriptures Hebrew Bible (OSHB) - Westminster Leningrad Codex - CC-BY 4.0 / Public Domain',
    hebrewNTSource: 'Delitzsch Hebrew New Testament - Public Domain',
    englishSource: 'World English Bible (WEB) - Public Domain',
    generatedAt: new Date().toISOString(),
    books: hebrewBookNames,
    totalVerses: allVerses.length,
    otVerses,
    ntVerses: ntVersesCount,
    verses: allVerses
  }, null, 2));

  console.log(`\n=== Conversion Complete ===`);
  console.log(`Total verses: ${allVerses.length}`);
  console.log(`  OT verses: ${otVerses}`);
  console.log(`  NT verses: ${ntVersesCount}`);
  console.log(`  Verses with Hebrew: ${versesWithHebrew}`);
  console.log(`  Verses with English: ${versesWithEnglish}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
}

// Run
convertOSHB().catch(err => {
  console.error('Conversion failed:', err);
  process.exit(1);
});
