// Hebrew to English book name mapping
export const hebrewBookNames: Record<string, string> = {
  'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus',
  'במדבר': 'Numbers', 'דברים': 'Deuteronomy', 'יהושע': 'Joshua',
  'שופטים': 'Judges', 'שמואל א': 'I Samuel', 'שמואל ב': 'II Samuel',
  'מלכים א': 'I Kings', 'מלכים ב': 'II Kings', 'ישעיהו': 'Isaiah',
  'ישעיה': 'Isaiah', 'ירמיהו': 'Jeremiah', 'ירמיה': 'Jeremiah',
  'יחזקאל': 'Ezekiel', 'הושע': 'Hosea', 'יואל': 'Joel', 'עמוס': 'Amos',
  'עובדיה': 'Obadiah', 'יונה': 'Jonah', 'מיכה': 'Micah', 'נחום': 'Nahum',
  'חבקוק': 'Habakkuk', 'צפניה': 'Zephaniah', 'חגי': 'Haggai',
  'זכריה': 'Zechariah', 'מלאכי': 'Malachi', 'תהילים': 'Psalms',
  'תהלים': 'Psalms', 'משלי': 'Proverbs', 'איוב': 'Job',
  'שיר השירים': 'Song of Songs', 'רות': 'Ruth', 'איכה': 'Lamentations',
  'קהלת': 'Ecclesiastes', 'אסתר': 'Esther', 'דניאל': 'Daniel',
  'עזרא': 'Ezra', 'נחמיה': 'Nehemiah', 'דברי הימים א': 'I Chronicles',
  'דברי הימים ב': 'II Chronicles',
  // New Testament
  'מתי': 'Matthew', 'מרקוס': 'Mark', 'לוקס': 'Luke', 'יוחנן': 'John',
  'מעשי השליחים': 'Acts', 'מעשים': 'Acts', 'רומים': 'Romans',
  'קורינתים א': '1 Corinthians', 'קורינתים ב': '2 Corinthians',
  'גלטים': 'Galatians', 'אפסים': 'Ephesians', 'פיליפים': 'Philippians',
  'קולוסים': 'Colossians', 'תסלוניקים א': '1 Thessalonians',
  'תסלוניקים ב': '2 Thessalonians', 'טימותיאוס א': '1 Timothy',
  'טימותיאוס ב': '2 Timothy', 'טיטוס': 'Titus', 'פילימון': 'Philemon',
  'עברים': 'Hebrews', 'יעקב': 'James', 'פטרוס א': '1 Peter',
  'פטרוס ב': '2 Peter', 'יוחנן א': '1 John', 'יוחנן ב': '2 John',
  'יוחנן ג': '3 John', 'יהודה': 'Jude', 'התגלות': 'Revelation', 'חזון': 'Revelation'
};

// Convert Hebrew numerals to Arabic numbers
export const hebrewToNumber = (hebrewStr: string): number | null => {
  const cleaned = hebrewStr.replace(/[""״׳']/g, '');
  const hebrewValues: Record<string, number> = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
    'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
    'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
    'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
  };
  let total = 0;
  for (const char of cleaned) {
    if (hebrewValues[char]) {
      total += hebrewValues[char];
    }
  }
  return total > 0 ? total : null;
};

// Convert Arabic numbers to Hebrew numerals
export const numberToHebrew = (num: number): string => {
  if (num <= 0 || num > 999) return num.toString();

  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

  let result = '';

  // Handle hundreds
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)];
    num %= 100;
  }

  // Special cases for 15 and 16 (avoid spelling God's name)
  if (num === 15) return result + 'טו';
  if (num === 16) return result + 'טז';

  // Handle tens
  if (num >= 10) {
    result += tens[Math.floor(num / 10)];
    num %= 10;
  }

  // Handle ones
  result += ones[num];

  return result;
};

// Get Hebrew book name from English
export const getHebrewBookName = (englishName: string): string => {
  // Find Hebrew name for this English book
  for (const [hebrew, english] of Object.entries(hebrewBookNames)) {
    if (english.toLowerCase() === englishName.toLowerCase()) {
      return hebrew;
    }
  }
  return englishName; // Fallback to English if not found
};

export interface BibleBook {
  name: string;
  chapters: number;
  hebrewName?: string;
  testament?: 'old' | 'new';
}

// Parse Bible search query and return matched book and chapter
export const parseBibleSearch = (
  query: string,
  bibleBooks: BibleBook[]
): { book: BibleBook | null; chapter: number | null } => {
  const trimmed = query.trim();

  if (trimmed === '') {
    return { book: null, chapter: null };
  }

  // Try to match pattern: "BookName Chapter" (Arabic or Hebrew numerals)
  const matchArabic = trimmed.match(/^(.+?)\s+(\d+)$/);
  const matchHebrew = trimmed.match(/^(.+?)\s+([א-ת""״׳']+)$/);

  let bookName: string | null = null;
  let chapterNum: number | null = null;

  if (matchArabic) {
    bookName = matchArabic[1].trim().toLowerCase();
    chapterNum = parseInt(matchArabic[2]);
  } else if (matchHebrew) {
    bookName = matchHebrew[1].trim().toLowerCase();
    const hebrewNum = hebrewToNumber(matchHebrew[2]);
    if (hebrewNum) {
      chapterNum = hebrewNum;
    }
  }

  if (!bookName || !chapterNum) {
    return { book: null, chapter: null };
  }

  // Check if bookName is Hebrew and convert to English
  let searchName = bookName;
  const hebrewMatch = Object.keys(hebrewBookNames).find(heb =>
    heb === bookName || heb.startsWith(bookName!) || bookName!.startsWith(heb)
  );
  if (hebrewMatch) {
    searchName = hebrewBookNames[hebrewMatch].toLowerCase();
  }

  // Find matching book with fuzzy matching
  let matchedBook = bibleBooks.find(b => b.name.toLowerCase() === searchName);

  if (!matchedBook) {
    // Try prefix match (e.g., "gen" matches "Genesis")
    matchedBook = bibleBooks.find(b => b.name.toLowerCase().startsWith(searchName));
  }

  if (!matchedBook) {
    // Try contains match (e.g., "corin" matches "1 Corinthians")
    matchedBook = bibleBooks.find(b => b.name.toLowerCase().includes(searchName));
  }

  if (matchedBook && chapterNum >= 1 && chapterNum <= matchedBook.chapters) {
    return { book: matchedBook, chapter: chapterNum };
  }

  return { book: null, chapter: null };
};
