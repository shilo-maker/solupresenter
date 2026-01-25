/**
 * Final Bible Data Verification
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'resources', 'bible-data', 'bible-complete.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log('=== FINAL BIBLE VERIFICATION ===\n');

// Stats
console.log('Total verses:', data.totalVerses);

const withBothLangs = data.verses.filter(v =>
  v.hebrewText && v.hebrewText.length > 0 &&
  v.englishText && v.englishText.length > 0
).length;
console.log('With both Hebrew & English:', withBothLangs, '(' + ((withBothLangs / data.totalVerses) * 100).toFixed(1) + '%)');

const hebrewOnly = data.verses.filter(v =>
  v.hebrewText && v.hebrewText.length > 0 &&
  (!v.englishText || v.englishText.length === 0)
).length;
console.log('Hebrew only (versification diff):', hebrewOnly);

const englishOnly = data.verses.filter(v =>
  (!v.hebrewText || v.hebrewText.length === 0) &&
  v.englishText && v.englishText.length > 0
).length;
console.log('English only:', englishOnly);

// Check for any remaining issues
const htmlInHeb = data.verses.filter(v => /&[a-z]+;/i.test(v.hebrewText || '')).length;
const htmlInEng = data.verses.filter(v => /<[a-z]+/i.test(v.englishText || '')).length;
const latinInHeb = data.verses.filter(v => {
  const heb = v.hebrewText || '';
  const latinMatch = heb.match(/[a-zA-Z]+/g);
  return latinMatch && latinMatch.join('').length > 3;
}).length;

console.log('\n=== QUALITY CHECKS ===');
console.log('HTML entities in Hebrew:', htmlInHeb);
console.log('HTML tags in English:', htmlInEng);
console.log('Latin chars in Hebrew:', latinInHeb);

// Check verse sequence integrity
let sequenceIssues = 0;
const books = [...new Set(data.verses.map(v => v.book))];
books.forEach(book => {
  const bookVerses = data.verses.filter(v => v.book === book);
  const chapters = [...new Set(bookVerses.map(v => v.chapter))].sort((a, b) => a - b);

  chapters.forEach(ch => {
    const chVerses = bookVerses.filter(v => v.chapter === ch).sort((a, b) => a.verse - b.verse);
    if (chVerses.length > 0 && chVerses[0].verse !== 1) {
      sequenceIssues++;
    }
  });
});
console.log('Chapters missing verse 1:', sequenceIssues);

// Sample check
console.log('\n=== SAMPLE VERSES ===');
const samples = [
  { book: 'Genesis', chapter: 1, verse: 1 },
  { book: 'Psalms', chapter: 23, verse: 1 },
  { book: 'Isaiah', chapter: 53, verse: 5 },
  { book: 'John', chapter: 3, verse: 16 },
  { book: 'Romans', chapter: 8, verse: 28 },
  { book: 'Revelation', chapter: 22, verse: 21 },
];

samples.forEach(s => {
  const v = data.verses.find(x => x.book === s.book && x.chapter === s.chapter && x.verse === s.verse);
  console.log('\n' + s.book + ' ' + s.chapter + ':' + s.verse);
  if (v) {
    console.log('  Heb: ' + (v.hebrewText || '').substring(0, 50) + '...');
    console.log('  Eng: ' + (v.englishText || '').substring(0, 50) + '...');
  } else {
    console.log('  NOT FOUND!');
  }
});

// File size
const stats = fs.statSync(dataPath);
console.log('\n=== FILE INFO ===');
console.log('File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');

console.log('\n=== VERIFICATION COMPLETE ===');
if (htmlInHeb === 0 && htmlInEng === 0 && latinInHeb === 0 && sequenceIssues === 0) {
  console.log('✓ All quality checks passed!');
} else {
  console.log('⚠ Some issues remain');
}
