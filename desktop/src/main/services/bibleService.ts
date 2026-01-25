/**
 * Bible Service - Local Bible Data
 *
 * Reads Bible data from locally bundled JSON file.
 * Supports Hebrew (OT from Sefaria, NT from Delitzsch) and English (WEB).
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface BibleBook {
  name: string;
  chapters: number;
  hebrewName?: string;
  testament?: 'old' | 'new';
}

export interface BibleVerse {
  verseNumber: number;
  hebrew: string;
  english: string;
  reference: string;
  hebrewReference: string;
}

export interface BibleChapterResponse {
  book: string;
  chapter: number;
  verses: BibleVerse[];
  totalVerses: number;
  testament: 'old' | 'new';
}

interface BibleDataVerse {
  book: string;
  bookNumber: number;
  testament: 'old' | 'new';
  chapter: number;
  verse: number;
  hebrewText: string;
  englishText: string;
}

interface BibleData {
  version: string;
  hebrewSource: string;
  englishSource: string;
  generatedAt: string;
  books: Record<string, string>;
  totalVerses: number;
  verses: BibleDataVerse[];
}

// Bible book data with Hebrew names
const BIBLE_BOOKS_DATA: Record<string, { hebrewName: string; testament: 'old' | 'new'; chapters: number }> = {
  // Old Testament
  'Genesis': { hebrewName: 'בראשית', testament: 'old', chapters: 50 },
  'Exodus': { hebrewName: 'שמות', testament: 'old', chapters: 40 },
  'Leviticus': { hebrewName: 'ויקרא', testament: 'old', chapters: 27 },
  'Numbers': { hebrewName: 'במדבר', testament: 'old', chapters: 36 },
  'Deuteronomy': { hebrewName: 'דברים', testament: 'old', chapters: 34 },
  'Joshua': { hebrewName: 'יהושע', testament: 'old', chapters: 24 },
  'Judges': { hebrewName: 'שופטים', testament: 'old', chapters: 21 },
  'Ruth': { hebrewName: 'רות', testament: 'old', chapters: 4 },
  'I Samuel': { hebrewName: 'שמואל א', testament: 'old', chapters: 31 },
  'II Samuel': { hebrewName: 'שמואל ב', testament: 'old', chapters: 24 },
  'I Kings': { hebrewName: 'מלכים א', testament: 'old', chapters: 22 },
  'II Kings': { hebrewName: 'מלכים ב', testament: 'old', chapters: 25 },
  'I Chronicles': { hebrewName: 'דברי הימים א', testament: 'old', chapters: 29 },
  'II Chronicles': { hebrewName: 'דברי הימים ב', testament: 'old', chapters: 36 },
  'Ezra': { hebrewName: 'עזרא', testament: 'old', chapters: 10 },
  'Nehemiah': { hebrewName: 'נחמיה', testament: 'old', chapters: 13 },
  'Esther': { hebrewName: 'אסתר', testament: 'old', chapters: 10 },
  'Job': { hebrewName: 'איוב', testament: 'old', chapters: 42 },
  'Psalms': { hebrewName: 'תהילים', testament: 'old', chapters: 150 },
  'Proverbs': { hebrewName: 'משלי', testament: 'old', chapters: 31 },
  'Ecclesiastes': { hebrewName: 'קהלת', testament: 'old', chapters: 12 },
  'Song of Songs': { hebrewName: 'שיר השירים', testament: 'old', chapters: 8 },
  'Isaiah': { hebrewName: 'ישעיהו', testament: 'old', chapters: 66 },
  'Jeremiah': { hebrewName: 'ירמיהו', testament: 'old', chapters: 52 },
  'Lamentations': { hebrewName: 'איכה', testament: 'old', chapters: 5 },
  'Ezekiel': { hebrewName: 'יחזקאל', testament: 'old', chapters: 48 },
  'Daniel': { hebrewName: 'דניאל', testament: 'old', chapters: 12 },
  'Hosea': { hebrewName: 'הושע', testament: 'old', chapters: 14 },
  'Joel': { hebrewName: 'יואל', testament: 'old', chapters: 3 },
  'Amos': { hebrewName: 'עמוס', testament: 'old', chapters: 9 },
  'Obadiah': { hebrewName: 'עובדיה', testament: 'old', chapters: 1 },
  'Jonah': { hebrewName: 'יונה', testament: 'old', chapters: 4 },
  'Micah': { hebrewName: 'מיכה', testament: 'old', chapters: 7 },
  'Nahum': { hebrewName: 'נחום', testament: 'old', chapters: 3 },
  'Habakkuk': { hebrewName: 'חבקוק', testament: 'old', chapters: 3 },
  'Zephaniah': { hebrewName: 'צפניה', testament: 'old', chapters: 3 },
  'Haggai': { hebrewName: 'חגי', testament: 'old', chapters: 2 },
  'Zechariah': { hebrewName: 'זכריה', testament: 'old', chapters: 14 },
  'Malachi': { hebrewName: 'מלאכי', testament: 'old', chapters: 4 },
  // New Testament
  'Matthew': { hebrewName: 'מתי', testament: 'new', chapters: 28 },
  'Mark': { hebrewName: 'מרקוס', testament: 'new', chapters: 16 },
  'Luke': { hebrewName: 'לוקס', testament: 'new', chapters: 24 },
  'John': { hebrewName: 'יוחנן', testament: 'new', chapters: 21 },
  'Acts': { hebrewName: 'מעשי השליחים', testament: 'new', chapters: 28 },
  'Romans': { hebrewName: 'אל הרומים', testament: 'new', chapters: 16 },
  '1 Corinthians': { hebrewName: 'אל הקורינתים א', testament: 'new', chapters: 16 },
  '2 Corinthians': { hebrewName: 'אל הקורינתים ב', testament: 'new', chapters: 13 },
  'Galatians': { hebrewName: 'אל הגלטים', testament: 'new', chapters: 6 },
  'Ephesians': { hebrewName: 'אל האפסים', testament: 'new', chapters: 6 },
  'Philippians': { hebrewName: 'אל הפיליפים', testament: 'new', chapters: 4 },
  'Colossians': { hebrewName: 'אל הקולוסים', testament: 'new', chapters: 4 },
  '1 Thessalonians': { hebrewName: 'אל התסלוניקים א', testament: 'new', chapters: 5 },
  '2 Thessalonians': { hebrewName: 'אל התסלוניקים ב', testament: 'new', chapters: 3 },
  '1 Timothy': { hebrewName: 'אל טימותיוס א', testament: 'new', chapters: 6 },
  '2 Timothy': { hebrewName: 'אל טימותיוס ב', testament: 'new', chapters: 4 },
  'Titus': { hebrewName: 'אל טיטוס', testament: 'new', chapters: 3 },
  'Philemon': { hebrewName: 'אל פילימון', testament: 'new', chapters: 1 },
  'Hebrews': { hebrewName: 'אל העברים', testament: 'new', chapters: 13 },
  'James': { hebrewName: 'יעקב', testament: 'new', chapters: 5 },
  '1 Peter': { hebrewName: 'פטרוס א', testament: 'new', chapters: 5 },
  '2 Peter': { hebrewName: 'פטרוס ב', testament: 'new', chapters: 3 },
  '1 John': { hebrewName: 'יוחנן א', testament: 'new', chapters: 5 },
  '2 John': { hebrewName: 'יוחנן ב', testament: 'new', chapters: 1 },
  '3 John': { hebrewName: 'יוחנן ג', testament: 'new', chapters: 1 },
  'Jude': { hebrewName: 'יהודה', testament: 'new', chapters: 1 },
  'Revelation': { hebrewName: 'התגלות', testament: 'new', chapters: 22 }
};

// Helper function to convert number to Hebrew numerals
function toHebrewNumeral(num: number): string {
  const hebrewNumerals = [
    ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'],  // 0-9
    ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'],   // 10-90
    ['', 'ק', 'ר', 'ש', 'ת']                               // 100-400
  ];

  if (num < 1 || num > 999) return num.toString();

  // Special cases for 15 and 16 (to avoid spelling God's name)
  if (num === 15) return 'ט״ו';
  if (num === 16) return 'ט״ז';

  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;

  let result = '';
  if (hundreds > 0) result += hebrewNumerals[2][hundreds];
  if (tens > 0) result += hebrewNumerals[1][tens];
  if (ones > 0) result += hebrewNumerals[0][ones];

  // Add geresh (׳) for single letter or gershayim (״) before last letter
  if (result.length === 1) {
    result += '׳';
  } else if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  }

  return result;
}

// Cached Bible data
let bibleData: BibleData | null = null;
let bibleDataLoadError: string | null = null;

// Indexed cache for fast verse lookups: Map<"book:chapter", BibleDataVerse[]>
let versesByChapter: Map<string, BibleDataVerse[]> | null = null;

/**
 * Get the path to the Bible data JSON file
 */
function getBibleDataPath(): string {
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development - use resources folder (from dist/main/services -> desktop/resources)
    return path.join(__dirname, '..', '..', '..', '..', 'resources', 'bible-data', 'bible-complete.json');
  } else {
    // Production - check multiple locations
    const possiblePaths = [
      path.join(process.resourcesPath, 'bible-data', 'bible-complete.json'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bible-data', 'bible-complete.json'),
      path.join(app.getAppPath(), 'resources', 'bible-data', 'bible-complete.json'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Return default path even if not found
    return possiblePaths[0];
  }
}

/**
 * Load Bible data from JSON file
 */
function loadBibleData(): BibleData | null {
  if (bibleData) return bibleData;
  if (bibleDataLoadError) return null;

  try {
    const dataPath = getBibleDataPath();
    console.log('[BibleService] Loading Bible data from:', dataPath);

    if (!fs.existsSync(dataPath)) {
      bibleDataLoadError = `Bible data file not found: ${dataPath}`;
      console.error('[BibleService]', bibleDataLoadError);
      return null;
    }

    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    bibleData = JSON.parse(fileContent);
    console.log('[BibleService] Bible data loaded successfully:', bibleData?.totalVerses, 'verses');

    // Build indexed cache for O(1) chapter lookups
    if (bibleData?.verses) {
      versesByChapter = new Map();
      for (const verse of bibleData.verses) {
        const key = `${verse.book}:${verse.chapter}`;
        if (!versesByChapter.has(key)) {
          versesByChapter.set(key, []);
        }
        versesByChapter.get(key)!.push(verse);
      }
      console.log('[BibleService] Built verse index with', versesByChapter.size, 'chapters');
    }

    return bibleData;
  } catch (error: any) {
    bibleDataLoadError = `Failed to load Bible data: ${error.message}`;
    console.error('[BibleService]', bibleDataLoadError);
    return null;
  }
}

/**
 * Get list of all Bible books with chapter counts
 */
export async function getBibleBooks(): Promise<BibleBook[]> {
  return Object.keys(BIBLE_BOOKS_DATA).map(name => ({
    name,
    chapters: BIBLE_BOOKS_DATA[name].chapters,
    hebrewName: BIBLE_BOOKS_DATA[name].hebrewName,
    testament: BIBLE_BOOKS_DATA[name].testament
  }));
}

/**
 * Get verses for a specific book and chapter
 */
export async function getBibleVerses(bookName: string, chapter: number): Promise<BibleChapterResponse> {
  const bookData = BIBLE_BOOKS_DATA[bookName];

  if (!bookData) {
    throw new Error(`Book not found: ${bookName}`);
  }

  if (chapter < 1 || chapter > bookData.chapters) {
    throw new Error(`Invalid chapter number: ${chapter} (book has ${bookData.chapters} chapters)`);
  }

  const data = loadBibleData();

  if (!data) {
    throw new Error(bibleDataLoadError || 'Bible data not available');
  }

  // Use indexed cache for O(1) lookup instead of O(n) filter
  const cacheKey = `${bookName}:${chapter}`;
  const chapterVerses = versesByChapter?.get(cacheKey) || [];

  if (chapterVerses.length === 0) {
    throw new Error(`No verses found for ${bookName} chapter ${chapter}`);
  }

  // Format verses for response
  const verses: BibleVerse[] = chapterVerses.map(v => ({
    verseNumber: v.verse,
    hebrew: v.hebrewText || '',
    english: v.englishText || '',
    reference: `${bookName} ${chapter}:${v.verse}`,
    hebrewReference: `${bookData.hebrewName} ${toHebrewNumeral(chapter)}:${v.verse}`
  }));

  return {
    book: bookName,
    chapter,
    verses,
    totalVerses: verses.length,
    testament: bookData.testament
  };
}

/**
 * Convert Bible chapter to slides format for display
 */
export function versesToSlides(verses: BibleVerse[], bookName: string, chapter: number) {
  return verses.map(verse => ({
    originalText: verse.hebrew,
    transliteration: '', // Bible verses don't have transliteration
    translation: verse.english,
    verseType: `${verse.verseNumber}`,
    reference: verse.reference,
    hebrewReference: verse.hebrewReference
  }));
}

/**
 * Check if Bible data is available
 */
export function isBibleDataAvailable(): boolean {
  const data = loadBibleData();
  return data !== null;
}

/**
 * Get Bible data load error if any
 */
export function getBibleDataError(): string | null {
  loadBibleData(); // Attempt to load
  return bibleDataLoadError;
}
