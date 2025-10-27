const mongoose = require('mongoose');
const axios = require('axios');
const BibleVerse = require('./models/BibleVerse');
require('dotenv').config();

// Helper function to strip HTML tags and clean text
const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<i[^>]*>.*?<\/i>/gi, '')
    .replace(/<small[^>]*>.*?<\/small>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&thinsp;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Bible book data
const BIBLE_BOOKS = {
  // Old Testament
  'Genesis': { chapters: 50, sefaria: 'Genesis', hebrewName: 'בראשית', testament: 'old', bookNumber: 1 },
  'Exodus': { chapters: 40, sefaria: 'Exodus', hebrewName: 'שמות', testament: 'old', bookNumber: 2 },
  'Leviticus': { chapters: 27, sefaria: 'Leviticus', hebrewName: 'ויקרא', testament: 'old', bookNumber: 3 },
  'Numbers': { chapters: 36, sefaria: 'Numbers', hebrewName: 'במדבר', testament: 'old', bookNumber: 4 },
  'Deuteronomy': { chapters: 34, sefaria: 'Deuteronomy', hebrewName: 'דברים', testament: 'old', bookNumber: 5 },
  'Joshua': { chapters: 24, sefaria: 'Joshua', hebrewName: 'יהושע', testament: 'old', bookNumber: 6 },
  'Judges': { chapters: 21, sefaria: 'Judges', hebrewName: 'שופטים', testament: 'old', bookNumber: 7 },
  'I Samuel': { chapters: 31, sefaria: 'I_Samuel', hebrewName: 'שמואל א', testament: 'old', bookNumber: 8 },
  'II Samuel': { chapters: 24, sefaria: 'II_Samuel', hebrewName: 'שמואל ב', testament: 'old', bookNumber: 9 },
  'I Kings': { chapters: 22, sefaria: 'I_Kings', hebrewName: 'מלכים א', testament: 'old', bookNumber: 10 },
  'II Kings': { chapters: 25, sefaria: 'II_Kings', hebrewName: 'מלכים ב', testament: 'old', bookNumber: 11 },
  'Isaiah': { chapters: 66, sefaria: 'Isaiah', hebrewName: 'ישעיהו', testament: 'old', bookNumber: 12 },
  'Jeremiah': { chapters: 52, sefaria: 'Jeremiah', hebrewName: 'ירמיהו', testament: 'old', bookNumber: 13 },
  'Ezekiel': { chapters: 48, sefaria: 'Ezekiel', hebrewName: 'יחזקאל', testament: 'old', bookNumber: 14 },
  'Hosea': { chapters: 14, sefaria: 'Hosea', hebrewName: 'הושע', testament: 'old', bookNumber: 15 },
  'Joel': { chapters: 4, sefaria: 'Joel', hebrewName: 'יואל', testament: 'old', bookNumber: 16 },
  'Amos': { chapters: 9, sefaria: 'Amos', hebrewName: 'עמוס', testament: 'old', bookNumber: 17 },
  'Obadiah': { chapters: 1, sefaria: 'Obadiah', hebrewName: 'עובדיה', testament: 'old', bookNumber: 18 },
  'Jonah': { chapters: 4, sefaria: 'Jonah', hebrewName: 'יונה', testament: 'old', bookNumber: 19 },
  'Micah': { chapters: 7, sefaria: 'Micah', hebrewName: 'מיכה', testament: 'old', bookNumber: 20 },
  'Nahum': { chapters: 3, sefaria: 'Nahum', hebrewName: 'נחום', testament: 'old', bookNumber: 21 },
  'Habakkuk': { chapters: 3, sefaria: 'Habakkuk', hebrewName: 'חבקוק', testament: 'old', bookNumber: 22 },
  'Zephaniah': { chapters: 3, sefaria: 'Zephaniah', hebrewName: 'צפניה', testament: 'old', bookNumber: 23 },
  'Haggai': { chapters: 2, sefaria: 'Haggai', hebrewName: 'חגי', testament: 'old', bookNumber: 24 },
  'Zechariah': { chapters: 14, sefaria: 'Zechariah', hebrewName: 'זכריה', testament: 'old', bookNumber: 25 },
  'Malachi': { chapters: 3, sefaria: 'Malachi', hebrewName: 'מלאכי', testament: 'old', bookNumber: 26 },
  'Psalms': { chapters: 150, sefaria: 'Psalms', hebrewName: 'תהילים', testament: 'old', bookNumber: 27 },
  'Proverbs': { chapters: 31, sefaria: 'Proverbs', hebrewName: 'משלי', testament: 'old', bookNumber: 28 },
  'Job': { chapters: 42, sefaria: 'Job', hebrewName: 'איוב', testament: 'old', bookNumber: 29 },
  'Song of Songs': { chapters: 8, sefaria: 'Song_of_Songs', hebrewName: 'שיר השירים', testament: 'old', bookNumber: 30 },
  'Ruth': { chapters: 4, sefaria: 'Ruth', hebrewName: 'רות', testament: 'old', bookNumber: 31 },
  'Lamentations': { chapters: 5, sefaria: 'Lamentations', hebrewName: 'איכה', testament: 'old', bookNumber: 32 },
  'Ecclesiastes': { chapters: 12, sefaria: 'Ecclesiastes', hebrewName: 'קהלת', testament: 'old', bookNumber: 33 },
  'Esther': { chapters: 10, sefaria: 'Esther', hebrewName: 'אסתר', testament: 'old', bookNumber: 34 },
  'Daniel': { chapters: 12, sefaria: 'Daniel', hebrewName: 'דניאל', testament: 'old', bookNumber: 35 },
  'Ezra': { chapters: 10, sefaria: 'Ezra', hebrewName: 'עזרא', testament: 'old', bookNumber: 36 },
  'Nehemiah': { chapters: 13, sefaria: 'Nehemiah', hebrewName: 'נחמיה', testament: 'old', bookNumber: 37 },
  'I Chronicles': { chapters: 29, sefaria: 'I_Chronicles', hebrewName: 'דברי הימים א', testament: 'old', bookNumber: 38 },
  'II Chronicles': { chapters: 36, sefaria: 'II_Chronicles', hebrewName: 'דברי הימים ב', testament: 'old', bookNumber: 39 },

  // New Testament
  'Matthew': { chapters: 28, bollsBook: 40, hebrewName: 'מתי', testament: 'new', bookNumber: 40 },
  'Mark': { chapters: 16, bollsBook: 41, hebrewName: 'מרקוס', testament: 'new', bookNumber: 41 },
  'Luke': { chapters: 24, bollsBook: 42, hebrewName: 'לוקס', testament: 'new', bookNumber: 42 },
  'John': { chapters: 21, bollsBook: 43, hebrewName: 'יוחנן', testament: 'new', bookNumber: 43 },
  'Acts': { chapters: 28, bollsBook: 44, hebrewName: 'מעשי השליחים', testament: 'new', bookNumber: 44 },
  'Romans': { chapters: 16, bollsBook: 45, hebrewName: 'אל הרומים', testament: 'new', bookNumber: 45 },
  '1 Corinthians': { chapters: 16, bollsBook: 46, hebrewName: 'אל הקורינתים א', testament: 'new', bookNumber: 46 },
  '2 Corinthians': { chapters: 13, bollsBook: 47, hebrewName: 'אל הקורינתים ב', testament: 'new', bookNumber: 47 },
  'Galatians': { chapters: 6, bollsBook: 48, hebrewName: 'אל הגלטים', testament: 'new', bookNumber: 48 },
  'Ephesians': { chapters: 6, bollsBook: 49, hebrewName: 'אל האפסים', testament: 'new', bookNumber: 49 },
  'Philippians': { chapters: 4, bollsBook: 50, hebrewName: 'אל הפיליפים', testament: 'new', bookNumber: 50 },
  'Colossians': { chapters: 4, bollsBook: 51, hebrewName: 'אל הקולוסים', testament: 'new', bookNumber: 51 },
  '1 Thessalonians': { chapters: 5, bollsBook: 52, hebrewName: 'אל התסלוניקים א', testament: 'new', bookNumber: 52 },
  '2 Thessalonians': { chapters: 3, bollsBook: 53, hebrewName: 'אל התסלוניקים ב', testament: 'new', bookNumber: 53 },
  '1 Timothy': { chapters: 6, bollsBook: 54, hebrewName: 'אל טימותיוס א', testament: 'new', bookNumber: 54 },
  '2 Timothy': { chapters: 4, bollsBook: 55, hebrewName: 'אל טימותיוס ב', testament: 'new', bookNumber: 55 },
  'Titus': { chapters: 3, bollsBook: 56, hebrewName: 'אל טיטוס', testament: 'new', bookNumber: 56 },
  'Philemon': { chapters: 1, bollsBook: 57, hebrewName: 'אל פילימון', testament: 'new', bookNumber: 57 },
  'Hebrews': { chapters: 13, bollsBook: 58, hebrewName: 'אל העברים', testament: 'new', bookNumber: 58 },
  'James': { chapters: 5, bollsBook: 59, hebrewName: 'יעקב', testament: 'new', bookNumber: 59 },
  '1 Peter': { chapters: 5, bollsBook: 60, hebrewName: 'פטרוס א', testament: 'new', bookNumber: 60 },
  '2 Peter': { chapters: 3, bollsBook: 61, hebrewName: 'פטרוס ב', testament: 'new', bookNumber: 61 },
  '1 John': { chapters: 5, bollsBook: 62, hebrewName: 'יוחנן א', testament: 'new', bookNumber: 62 },
  '2 John': { chapters: 1, bollsBook: 63, hebrewName: 'יוחנן ב', testament: 'new', bookNumber: 63 },
  '3 John': { chapters: 1, bollsBook: 64, hebrewName: 'יוחנן ג', testament: 'new', bookNumber: 64 },
  'Jude': { chapters: 1, bollsBook: 65, hebrewName: 'יהודה', testament: 'new', bookNumber: 65 },
  'Revelation': { chapters: 22, bollsBook: 66, hebrewName: 'התגלות', testament: 'new', bookNumber: 66 }
};

// Delay helper to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seedBible() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solupresenter');
    console.log('Connected to MongoDB');

    // Clear existing verses
    console.log('Clearing existing Bible verses...');
    await BibleVerse.deleteMany({});
    console.log('Cleared existing verses');

    let totalVerses = 0;
    let totalChapters = 0;

    for (const [bookName, bookData] of Object.entries(BIBLE_BOOKS)) {
      console.log(`\nProcessing ${bookName} (${bookData.chapters} chapters)...`);

      for (let chapter = 1; chapter <= bookData.chapters; chapter++) {
        try {
          let versesData = [];

          if (bookData.testament === 'old') {
            // Fetch from Sefaria API for Old Testament
            const sefariaRef = `${bookData.sefaria}.${chapter}`;
            console.log(`  Fetching ${bookName} ${chapter} from Sefaria...`);

            const response = await axios.get(`https://www.sefaria.org/api/texts/${sefariaRef}`, {
              params: { context: 0, pad: 0 }
            });

            const data = response.data;
            const hebrewVerses = data.he || [];
            const englishVerses = data.text || [];
            const maxVerses = Math.max(hebrewVerses.length, englishVerses.length);

            for (let i = 0; i < maxVerses; i++) {
              versesData.push({
                book: bookName,
                bookNumber: bookData.bookNumber,
                testament: 'old',
                chapter: chapter,
                verse: i + 1,
                hebrewText: stripHtml(hebrewVerses[i]) || '',
                englishText: stripHtml(englishVerses[i]) || '',
                reference: `${bookName} ${chapter}:${i + 1}`
              });
            }
          } else {
            // Fetch from bolls.life for New Testament
            const bookNum = bookData.bollsBook;
            console.log(`  Fetching ${bookName} ${chapter} from bolls.life...`);

            const [hebrewResponse, englishResponse] = await Promise.all([
              axios.get(`https://bolls.life/get-text/DHNT/${bookNum}/${chapter}/`),
              axios.get(`https://bolls.life/get-text/WEB/${bookNum}/${chapter}/`)
            ]);

            const hebrewVerses = hebrewResponse.data || [];
            const englishVerses = englishResponse.data || [];

            const englishMap = {};
            englishVerses.forEach(v => {
              englishMap[v.verse] = v.text;
            });

            for (let i = 0; i < hebrewVerses.length; i++) {
              const verseNum = hebrewVerses[i].verse;
              versesData.push({
                book: bookName,
                bookNumber: bookData.bookNumber,
                testament: 'new',
                chapter: chapter,
                verse: verseNum,
                hebrewText: stripHtml(hebrewVerses[i].text) || '',
                englishText: stripHtml(englishMap[verseNum]) || '',
                reference: `${bookName} ${chapter}:${verseNum}`
              });
            }
          }

          // Insert verses into database
          if (versesData.length > 0) {
            await BibleVerse.insertMany(versesData);
            totalVerses += versesData.length;
            totalChapters++;
            console.log(`  ✓ Saved ${versesData.length} verses from ${bookName} ${chapter}`);
          }

          // Add delay to avoid rate limiting
          await delay(100);

        } catch (error) {
          console.error(`  ✗ Error fetching ${bookName} ${chapter}:`, error.message);
        }
      }
    }

    console.log('\n========================================');
    console.log(`Seeding complete!`);
    console.log(`Total chapters: ${totalChapters}`);
    console.log(`Total verses: ${totalVerses}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seed function
seedBible();
