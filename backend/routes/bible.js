const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper function to convert number to Hebrew numerals
function toHebrewNumeral(num) {
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

  // Add geresh (׳) for single letter or gershayim (״) before last letter for multiple letters
  if (result.length === 1) {
    result += '׳';
  } else if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  }

  return result;
}

// Bible book data with chapter counts and API references
const BIBLE_BOOKS = {
  // Old Testament (Hebrew Bible) - using Sefaria
  'Genesis': { chapters: 50, sefaria: 'Genesis', hebrewName: 'בראשית', testament: 'old' },
  'Exodus': { chapters: 40, sefaria: 'Exodus', hebrewName: 'שמות', testament: 'old' },
  'Leviticus': { chapters: 27, sefaria: 'Leviticus', hebrewName: 'ויקרא', testament: 'old' },
  'Numbers': { chapters: 36, sefaria: 'Numbers', hebrewName: 'במדבר', testament: 'old' },
  'Deuteronomy': { chapters: 34, sefaria: 'Deuteronomy', hebrewName: 'דברים', testament: 'old' },
  'Joshua': { chapters: 24, sefaria: 'Joshua', hebrewName: 'יהושע', testament: 'old' },
  'Judges': { chapters: 21, sefaria: 'Judges', hebrewName: 'שופטים', testament: 'old' },
  'I Samuel': { chapters: 31, sefaria: 'I_Samuel', hebrewName: 'שמואל א', testament: 'old' },
  'II Samuel': { chapters: 24, sefaria: 'II_Samuel', hebrewName: 'שמואל ב', testament: 'old' },
  'I Kings': { chapters: 22, sefaria: 'I_Kings', hebrewName: 'מלכים א', testament: 'old' },
  'II Kings': { chapters: 25, sefaria: 'II_Kings', hebrewName: 'מלכים ב', testament: 'old' },
  'Isaiah': { chapters: 66, sefaria: 'Isaiah', hebrewName: 'ישעיהו', testament: 'old' },
  'Jeremiah': { chapters: 52, sefaria: 'Jeremiah', hebrewName: 'ירמיהו', testament: 'old' },
  'Ezekiel': { chapters: 48, sefaria: 'Ezekiel', hebrewName: 'יחזקאל', testament: 'old' },
  'Hosea': { chapters: 14, sefaria: 'Hosea', hebrewName: 'הושע', testament: 'old' },
  'Joel': { chapters: 4, sefaria: 'Joel', hebrewName: 'יואל', testament: 'old' },
  'Amos': { chapters: 9, sefaria: 'Amos', hebrewName: 'עמוס', testament: 'old' },
  'Obadiah': { chapters: 1, sefaria: 'Obadiah', hebrewName: 'עובדיה', testament: 'old' },
  'Jonah': { chapters: 4, sefaria: 'Jonah', hebrewName: 'יונה', testament: 'old' },
  'Micah': { chapters: 7, sefaria: 'Micah', hebrewName: 'מיכה', testament: 'old' },
  'Nahum': { chapters: 3, sefaria: 'Nahum', hebrewName: 'נחום', testament: 'old' },
  'Habakkuk': { chapters: 3, sefaria: 'Habakkuk', hebrewName: 'חבקוק', testament: 'old' },
  'Zephaniah': { chapters: 3, sefaria: 'Zephaniah', hebrewName: 'צפניה', testament: 'old' },
  'Haggai': { chapters: 2, sefaria: 'Haggai', hebrewName: 'חגי', testament: 'old' },
  'Zechariah': { chapters: 14, sefaria: 'Zechariah', hebrewName: 'זכריה', testament: 'old' },
  'Malachi': { chapters: 3, sefaria: 'Malachi', hebrewName: 'מלאכי', testament: 'old' },
  'Psalms': { chapters: 150, sefaria: 'Psalms', hebrewName: 'תהילים', testament: 'old' },
  'Proverbs': { chapters: 31, sefaria: 'Proverbs', hebrewName: 'משלי', testament: 'old' },
  'Job': { chapters: 42, sefaria: 'Job', hebrewName: 'איוב', testament: 'old' },
  'Song of Songs': { chapters: 8, sefaria: 'Song_of_Songs', hebrewName: 'שיר השירים', testament: 'old' },
  'Ruth': { chapters: 4, sefaria: 'Ruth', hebrewName: 'רות', testament: 'old' },
  'Lamentations': { chapters: 5, sefaria: 'Lamentations', hebrewName: 'איכה', testament: 'old' },
  'Ecclesiastes': { chapters: 12, sefaria: 'Ecclesiastes', hebrewName: 'קהלת', testament: 'old' },
  'Esther': { chapters: 10, sefaria: 'Esther', hebrewName: 'אסתר', testament: 'old' },
  'Daniel': { chapters: 12, sefaria: 'Daniel', hebrewName: 'דניאל', testament: 'old' },
  'Ezra': { chapters: 10, sefaria: 'Ezra', hebrewName: 'עזרא', testament: 'old' },
  'Nehemiah': { chapters: 13, sefaria: 'Nehemiah', hebrewName: 'נחמיה', testament: 'old' },
  'I Chronicles': { chapters: 29, sefaria: 'I_Chronicles', hebrewName: 'דברי הימים א', testament: 'old' },
  'II Chronicles': { chapters: 36, sefaria: 'II_Chronicles', hebrewName: 'דברי הימים ב', testament: 'old' },

  // New Testament - using bolls.life API (DHNT for Hebrew, WEB for English)
  'Matthew': { chapters: 28, bollsBook: 40, hebrewName: 'מתי', testament: 'new' },
  'Mark': { chapters: 16, bollsBook: 41, hebrewName: 'מרקוס', testament: 'new' },
  'Luke': { chapters: 24, bollsBook: 42, hebrewName: 'לוקס', testament: 'new' },
  'John': { chapters: 21, bollsBook: 43, hebrewName: 'יוחנן', testament: 'new' },
  'Acts': { chapters: 28, bollsBook: 44, hebrewName: 'מעשי השליחים', testament: 'new' },
  'Romans': { chapters: 16, bollsBook: 45, hebrewName: 'אל הרומים', testament: 'new' },
  '1 Corinthians': { chapters: 16, bollsBook: 46, hebrewName: 'אל הקורינתים א', testament: 'new' },
  '2 Corinthians': { chapters: 13, bollsBook: 47, hebrewName: 'אל הקורינתים ב', testament: 'new' },
  'Galatians': { chapters: 6, bollsBook: 48, hebrewName: 'אל הגלטים', testament: 'new' },
  'Ephesians': { chapters: 6, bollsBook: 49, hebrewName: 'אל האפסים', testament: 'new' },
  'Philippians': { chapters: 4, bollsBook: 50, hebrewName: 'אל הפיליפים', testament: 'new' },
  'Colossians': { chapters: 4, bollsBook: 51, hebrewName: 'אל הקולוסים', testament: 'new' },
  '1 Thessalonians': { chapters: 5, bollsBook: 52, hebrewName: 'אל התסלוניקים א', testament: 'new' },
  '2 Thessalonians': { chapters: 3, bollsBook: 53, hebrewName: 'אל התסלוניקים ב', testament: 'new' },
  '1 Timothy': { chapters: 6, bollsBook: 54, hebrewName: 'אל טימותיוס א', testament: 'new' },
  '2 Timothy': { chapters: 4, bollsBook: 55, hebrewName: 'אל טימותיוס ב', testament: 'new' },
  'Titus': { chapters: 3, bollsBook: 56, hebrewName: 'אל טיטוס', testament: 'new' },
  'Philemon': { chapters: 1, bollsBook: 57, hebrewName: 'אל פילימון', testament: 'new' },
  'Hebrews': { chapters: 13, bollsBook: 58, hebrewName: 'אל העברים', testament: 'new' },
  'James': { chapters: 5, bollsBook: 59, hebrewName: 'יעקב', testament: 'new' },
  '1 Peter': { chapters: 5, bollsBook: 60, hebrewName: 'פטרוס א', testament: 'new' },
  '2 Peter': { chapters: 3, bollsBook: 61, hebrewName: 'פטרוס ב', testament: 'new' },
  '1 John': { chapters: 5, bollsBook: 62, hebrewName: 'יוחנן א', testament: 'new' },
  '2 John': { chapters: 1, bollsBook: 63, hebrewName: 'יוחנן ב', testament: 'new' },
  '3 John': { chapters: 1, bollsBook: 64, hebrewName: 'יוחנן ג', testament: 'new' },
  'Jude': { chapters: 1, bollsBook: 65, hebrewName: 'יהודה', testament: 'new' },
  'Revelation': { chapters: 22, bollsBook: 66, hebrewName: 'התגלות', testament: 'new' }
};

// Get list of books with chapter counts
router.get('/books', (req, res) => {
  const books = Object.keys(BIBLE_BOOKS).map(book => ({
    name: book,
    chapters: BIBLE_BOOKS[book].chapters
  }));
  res.json({ books });
});

// Get chapter count for a specific book
router.get('/books/:bookName/chapters', (req, res) => {
  const bookName = req.params.bookName;
  const bookData = BIBLE_BOOKS[bookName];

  if (!bookData) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.json({
    book: bookName,
    chapters: bookData.chapters
  });
});

// Get verses for a specific book and chapter
router.get('/verses/:bookName/:chapter', async (req, res) => {
  try {
    const { bookName, chapter } = req.params;
    const bookData = BIBLE_BOOKS[bookName];

    if (!bookData) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const chapterNum = parseInt(chapter);
    if (isNaN(chapterNum) || chapterNum < 1 || chapterNum > bookData.chapters) {
      return res.status(400).json({ error: 'Invalid chapter number' });
    }

    // Helper function to strip HTML tags and clean text
    const stripHtml = (html) => {
      if (!html) return '';
      return html
        .replace(/<br\s*\/?>/gi, '\n')  // Replace <br> with newline
        .replace(/<sup[^>]*>.*?<\/sup>/gi, '')  // Remove superscript footnotes
        .replace(/<i[^>]*>.*?<\/i>/gi, '')  // Remove italic footnotes
        .replace(/<small[^>]*>.*?<\/small>/gi, '')  // Remove small text
        .replace(/<[^>]+>/g, '')  // Remove any remaining HTML tags
        .replace(/&thinsp;/g, ' ')  // Replace thin space entity
        .replace(/&nbsp;/g, ' ')  // Replace non-breaking space
        .replace(/\s+/g, ' ')  // Normalize multiple spaces
        .trim();
    };

    let verses = [];

    if (bookData.testament === 'old') {
      // Fetch from Sefaria API for Old Testament (has Hebrew + English)
      const sefariaRef = `${bookData.sefaria}.${chapter}`;
      const response = await axios.get(`https://www.sefaria.org/api/texts/${sefariaRef}`, {
        params: {
          context: 0,
          pad: 0
        }
      });

      const data = response.data;
      const hebrewVerses = data.he || [];
      const englishVerses = data.text || [];
      const maxVerses = Math.max(hebrewVerses.length, englishVerses.length);

      for (let i = 0; i < maxVerses; i++) {
        verses.push({
          verseNumber: i + 1,
          hebrew: stripHtml(hebrewVerses[i]) || '',
          english: stripHtml(englishVerses[i]) || '',
          reference: `${bookName} ${chapter}:${i + 1}`,
          hebrewReference: `${bookData.hebrewName} ${toHebrewNumeral(chapterNum)}:${i + 1}`
        });
      }
    } else {
      // Fetch from bolls.life for New Testament (Hebrew DHNT + English WEB)
      const bookNum = bookData.bollsBook;

      // Fetch both Hebrew and English in parallel
      const [hebrewResponse, englishResponse] = await Promise.all([
        axios.get(`https://bolls.life/get-text/DHNT/${bookNum}/${chapter}/`),
        axios.get(`https://bolls.life/get-text/WEB/${bookNum}/${chapter}/`)
      ]);

      const hebrewVerses = hebrewResponse.data || [];
      const englishVerses = englishResponse.data || [];

      // Create a map of English verses by verse number for easy lookup
      const englishMap = {};
      englishVerses.forEach(v => {
        englishMap[v.verse] = v.text;
      });

      // Combine Hebrew and English verses
      for (let i = 0; i < hebrewVerses.length; i++) {
        const verseNum = hebrewVerses[i].verse;
        verses.push({
          verseNumber: verseNum,
          hebrew: stripHtml(hebrewVerses[i].text) || '',
          english: stripHtml(englishMap[verseNum]) || '',
          reference: `${bookName} ${chapter}:${verseNum}`,
          hebrewReference: `${bookData.hebrewName} ${toHebrewNumeral(chapterNum)}:${verseNum}`
        });
      }
    }

    res.json({
      book: bookName,
      chapter: chapterNum,
      verses: verses,
      totalVerses: verses.length,
      testament: bookData.testament
    });

  } catch (error) {
    console.error('Error fetching Bible verses:', error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    res.status(500).json({ error: 'Failed to fetch Bible verses' });
  }
});

module.exports = router;
