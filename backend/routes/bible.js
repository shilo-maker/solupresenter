const express = require('express');
const router = express.Router();
const axios = require('axios');

// Bible book data with chapter counts and API references
const BIBLE_BOOKS = {
  // Old Testament (Hebrew Bible) - using Sefaria
  'Genesis': { chapters: 50, sefaria: 'Genesis', testament: 'old' },
  'Exodus': { chapters: 40, sefaria: 'Exodus', testament: 'old' },
  'Leviticus': { chapters: 27, sefaria: 'Leviticus', testament: 'old' },
  'Numbers': { chapters: 36, sefaria: 'Numbers', testament: 'old' },
  'Deuteronomy': { chapters: 34, sefaria: 'Deuteronomy', testament: 'old' },
  'Joshua': { chapters: 24, sefaria: 'Joshua', testament: 'old' },
  'Judges': { chapters: 21, sefaria: 'Judges', testament: 'old' },
  'I Samuel': { chapters: 31, sefaria: 'I_Samuel', testament: 'old' },
  'II Samuel': { chapters: 24, sefaria: 'II_Samuel', testament: 'old' },
  'I Kings': { chapters: 22, sefaria: 'I_Kings', testament: 'old' },
  'II Kings': { chapters: 25, sefaria: 'II_Kings', testament: 'old' },
  'Isaiah': { chapters: 66, sefaria: 'Isaiah', testament: 'old' },
  'Jeremiah': { chapters: 52, sefaria: 'Jeremiah', testament: 'old' },
  'Ezekiel': { chapters: 48, sefaria: 'Ezekiel', testament: 'old' },
  'Hosea': { chapters: 14, sefaria: 'Hosea', testament: 'old' },
  'Joel': { chapters: 4, sefaria: 'Joel', testament: 'old' },
  'Amos': { chapters: 9, sefaria: 'Amos', testament: 'old' },
  'Obadiah': { chapters: 1, sefaria: 'Obadiah', testament: 'old' },
  'Jonah': { chapters: 4, sefaria: 'Jonah', testament: 'old' },
  'Micah': { chapters: 7, sefaria: 'Micah', testament: 'old' },
  'Nahum': { chapters: 3, sefaria: 'Nahum', testament: 'old' },
  'Habakkuk': { chapters: 3, sefaria: 'Habakkuk', testament: 'old' },
  'Zephaniah': { chapters: 3, sefaria: 'Zephaniah', testament: 'old' },
  'Haggai': { chapters: 2, sefaria: 'Haggai', testament: 'old' },
  'Zechariah': { chapters: 14, sefaria: 'Zechariah', testament: 'old' },
  'Malachi': { chapters: 3, sefaria: 'Malachi', testament: 'old' },
  'Psalms': { chapters: 150, sefaria: 'Psalms', testament: 'old' },
  'Proverbs': { chapters: 31, sefaria: 'Proverbs', testament: 'old' },
  'Job': { chapters: 42, sefaria: 'Job', testament: 'old' },
  'Song of Songs': { chapters: 8, sefaria: 'Song_of_Songs', testament: 'old' },
  'Ruth': { chapters: 4, sefaria: 'Ruth', testament: 'old' },
  'Lamentations': { chapters: 5, sefaria: 'Lamentations', testament: 'old' },
  'Ecclesiastes': { chapters: 12, sefaria: 'Ecclesiastes', testament: 'old' },
  'Esther': { chapters: 10, sefaria: 'Esther', testament: 'old' },
  'Daniel': { chapters: 12, sefaria: 'Daniel', testament: 'old' },
  'Ezra': { chapters: 10, sefaria: 'Ezra', testament: 'old' },
  'Nehemiah': { chapters: 13, sefaria: 'Nehemiah', testament: 'old' },
  'I Chronicles': { chapters: 29, sefaria: 'I_Chronicles', testament: 'old' },
  'II Chronicles': { chapters: 36, sefaria: 'II_Chronicles', testament: 'old' },

  // New Testament - using bolls.life API (DHNT for Hebrew, WEB for English)
  'Matthew': { chapters: 28, bollsBook: 40, testament: 'new' },
  'Mark': { chapters: 16, bollsBook: 41, testament: 'new' },
  'Luke': { chapters: 24, bollsBook: 42, testament: 'new' },
  'John': { chapters: 21, bollsBook: 43, testament: 'new' },
  'Acts': { chapters: 28, bollsBook: 44, testament: 'new' },
  'Romans': { chapters: 16, bollsBook: 45, testament: 'new' },
  '1 Corinthians': { chapters: 16, bollsBook: 46, testament: 'new' },
  '2 Corinthians': { chapters: 13, bollsBook: 47, testament: 'new' },
  'Galatians': { chapters: 6, bollsBook: 48, testament: 'new' },
  'Ephesians': { chapters: 6, bollsBook: 49, testament: 'new' },
  'Philippians': { chapters: 4, bollsBook: 50, testament: 'new' },
  'Colossians': { chapters: 4, bollsBook: 51, testament: 'new' },
  '1 Thessalonians': { chapters: 5, bollsBook: 52, testament: 'new' },
  '2 Thessalonians': { chapters: 3, bollsBook: 53, testament: 'new' },
  '1 Timothy': { chapters: 6, bollsBook: 54, testament: 'new' },
  '2 Timothy': { chapters: 4, bollsBook: 55, testament: 'new' },
  'Titus': { chapters: 3, bollsBook: 56, testament: 'new' },
  'Philemon': { chapters: 1, bollsBook: 57, testament: 'new' },
  'Hebrews': { chapters: 13, bollsBook: 58, testament: 'new' },
  'James': { chapters: 5, bollsBook: 59, testament: 'new' },
  '1 Peter': { chapters: 5, bollsBook: 60, testament: 'new' },
  '2 Peter': { chapters: 3, bollsBook: 61, testament: 'new' },
  '1 John': { chapters: 5, bollsBook: 62, testament: 'new' },
  '2 John': { chapters: 1, bollsBook: 63, testament: 'new' },
  '3 John': { chapters: 1, bollsBook: 64, testament: 'new' },
  'Jude': { chapters: 1, bollsBook: 65, testament: 'new' },
  'Revelation': { chapters: 22, bollsBook: 66, testament: 'new' }
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
          reference: `${bookName} ${chapter}:${i + 1}`
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
          reference: `${bookName} ${chapter}:${verseNum}`
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
