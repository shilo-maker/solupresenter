/**
 * Bible Service for fetching Bible verses from the backend API
 */

import axios from 'axios';

const BACKEND_URL = 'https://solupresenter-backend-4rn5.onrender.com';

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

// Bible book data with Hebrew names (cached locally to avoid extra API calls)
const BIBLE_BOOKS_DATA: Record<string, { hebrewName: string; testament: 'old' | 'new' }> = {
  // Old Testament
  'Genesis': { hebrewName: 'בראשית', testament: 'old' },
  'Exodus': { hebrewName: 'שמות', testament: 'old' },
  'Leviticus': { hebrewName: 'ויקרא', testament: 'old' },
  'Numbers': { hebrewName: 'במדבר', testament: 'old' },
  'Deuteronomy': { hebrewName: 'דברים', testament: 'old' },
  'Joshua': { hebrewName: 'יהושע', testament: 'old' },
  'Judges': { hebrewName: 'שופטים', testament: 'old' },
  'I Samuel': { hebrewName: 'שמואל א', testament: 'old' },
  'II Samuel': { hebrewName: 'שמואל ב', testament: 'old' },
  'I Kings': { hebrewName: 'מלכים א', testament: 'old' },
  'II Kings': { hebrewName: 'מלכים ב', testament: 'old' },
  'Isaiah': { hebrewName: 'ישעיהו', testament: 'old' },
  'Jeremiah': { hebrewName: 'ירמיהו', testament: 'old' },
  'Ezekiel': { hebrewName: 'יחזקאל', testament: 'old' },
  'Hosea': { hebrewName: 'הושע', testament: 'old' },
  'Joel': { hebrewName: 'יואל', testament: 'old' },
  'Amos': { hebrewName: 'עמוס', testament: 'old' },
  'Obadiah': { hebrewName: 'עובדיה', testament: 'old' },
  'Jonah': { hebrewName: 'יונה', testament: 'old' },
  'Micah': { hebrewName: 'מיכה', testament: 'old' },
  'Nahum': { hebrewName: 'נחום', testament: 'old' },
  'Habakkuk': { hebrewName: 'חבקוק', testament: 'old' },
  'Zephaniah': { hebrewName: 'צפניה', testament: 'old' },
  'Haggai': { hebrewName: 'חגי', testament: 'old' },
  'Zechariah': { hebrewName: 'זכריה', testament: 'old' },
  'Malachi': { hebrewName: 'מלאכי', testament: 'old' },
  'Psalms': { hebrewName: 'תהילים', testament: 'old' },
  'Proverbs': { hebrewName: 'משלי', testament: 'old' },
  'Job': { hebrewName: 'איוב', testament: 'old' },
  'Song of Songs': { hebrewName: 'שיר השירים', testament: 'old' },
  'Ruth': { hebrewName: 'רות', testament: 'old' },
  'Lamentations': { hebrewName: 'איכה', testament: 'old' },
  'Ecclesiastes': { hebrewName: 'קהלת', testament: 'old' },
  'Esther': { hebrewName: 'אסתר', testament: 'old' },
  'Daniel': { hebrewName: 'דניאל', testament: 'old' },
  'Ezra': { hebrewName: 'עזרא', testament: 'old' },
  'Nehemiah': { hebrewName: 'נחמיה', testament: 'old' },
  'I Chronicles': { hebrewName: 'דברי הימים א', testament: 'old' },
  'II Chronicles': { hebrewName: 'דברי הימים ב', testament: 'old' },
  // New Testament
  'Matthew': { hebrewName: 'מתי', testament: 'new' },
  'Mark': { hebrewName: 'מרקוס', testament: 'new' },
  'Luke': { hebrewName: 'לוקס', testament: 'new' },
  'John': { hebrewName: 'יוחנן', testament: 'new' },
  'Acts': { hebrewName: 'מעשי השליחים', testament: 'new' },
  'Romans': { hebrewName: 'אל הרומים', testament: 'new' },
  '1 Corinthians': { hebrewName: 'אל הקורינתים א', testament: 'new' },
  '2 Corinthians': { hebrewName: 'אל הקורינתים ב', testament: 'new' },
  'Galatians': { hebrewName: 'אל הגלטים', testament: 'new' },
  'Ephesians': { hebrewName: 'אל האפסים', testament: 'new' },
  'Philippians': { hebrewName: 'אל הפיליפים', testament: 'new' },
  'Colossians': { hebrewName: 'אל הקולוסים', testament: 'new' },
  '1 Thessalonians': { hebrewName: 'אל התסלוניקים א', testament: 'new' },
  '2 Thessalonians': { hebrewName: 'אל התסלוניקים ב', testament: 'new' },
  '1 Timothy': { hebrewName: 'אל טימותיוס א', testament: 'new' },
  '2 Timothy': { hebrewName: 'אל טימותיוס ב', testament: 'new' },
  'Titus': { hebrewName: 'אל טיטוס', testament: 'new' },
  'Philemon': { hebrewName: 'אל פילימון', testament: 'new' },
  'Hebrews': { hebrewName: 'אל העברים', testament: 'new' },
  'James': { hebrewName: 'יעקב', testament: 'new' },
  '1 Peter': { hebrewName: 'פטרוס א', testament: 'new' },
  '2 Peter': { hebrewName: 'פטרוס ב', testament: 'new' },
  '1 John': { hebrewName: 'יוחנן א', testament: 'new' },
  '2 John': { hebrewName: 'יוחנן ב', testament: 'new' },
  '3 John': { hebrewName: 'יוחנן ג', testament: 'new' },
  'Jude': { hebrewName: 'יהודה', testament: 'new' },
  'Revelation': { hebrewName: 'התגלות', testament: 'new' }
};

/**
 * Get list of all Bible books with chapter counts
 */
export async function getBibleBooks(): Promise<BibleBook[]> {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/bible/books`);
    const books = response.data.books as Array<{ name: string; chapters: number }>;

    // Enrich with Hebrew names and testament info
    return books.map(book => ({
      ...book,
      hebrewName: BIBLE_BOOKS_DATA[book.name]?.hebrewName || book.name,
      testament: BIBLE_BOOKS_DATA[book.name]?.testament || 'old'
    }));
  } catch (error: any) {
    console.error('Error fetching Bible books:', error.message);
    throw new Error('Failed to fetch Bible books');
  }
}

/**
 * Get verses for a specific book and chapter
 */
export async function getBibleVerses(bookName: string, chapter: number): Promise<BibleChapterResponse> {
  try {
    const response = await axios.get(
      `${BACKEND_URL}/api/bible/verses/${encodeURIComponent(bookName)}/${chapter}`
    );
    return response.data;
  } catch (error: any) {
    console.error('Error fetching Bible verses:', error.message);
    throw new Error('Failed to fetch Bible verses');
  }
}

/**
 * Convert Bible chapter to slides format for display
 */
export function versesToSlides(verses: BibleVerse[], bookName: string, chapter: number) {
  const bookData = BIBLE_BOOKS_DATA[bookName];

  return verses.map(verse => ({
    originalText: verse.hebrew,
    transliteration: '', // Bible verses don't have transliteration
    translation: verse.english,
    verseType: `${verse.verseNumber}`,
    reference: verse.reference,
    hebrewReference: verse.hebrewReference
  }));
}
