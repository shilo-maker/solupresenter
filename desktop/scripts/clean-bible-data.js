/**
 * Clean HTML entities from Bible data
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'resources', 'bible-data', 'bible-complete.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log('Cleaning HTML entities from Bible data...\n');

// Clean HTML entities
function cleanHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&thinsp;/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-zA-Z0-9]+;/g, '') // catch any other entities
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

let hebrewCleaned = 0;
let englishCleaned = 0;

data.verses = data.verses.map(v => {
  const oldHeb = v.hebrewText || '';
  const oldEng = v.englishText || '';
  const newHeb = cleanHtmlEntities(oldHeb);
  const newEng = cleanHtmlEntities(oldEng);

  if (oldHeb !== newHeb) hebrewCleaned++;
  if (oldEng !== newEng) englishCleaned++;

  return { ...v, hebrewText: newHeb, englishText: newEng };
});

console.log('Hebrew verses cleaned:', hebrewCleaned);
console.log('English verses cleaned:', englishCleaned);

// Verify no more entities
const stillHasEntities = data.verses.filter(v =>
  /&[a-zA-Z]+;/.test(v.hebrewText || '') || /&[a-zA-Z]+;/.test(v.englishText || '')
).length;
console.log('Verses still with HTML entities:', stillHasEntities);

// Check Latin chars in Hebrew now
const latinVerses = data.verses.filter(v => {
  const heb = v.hebrewText || '';
  const latinMatch = heb.match(/[a-zA-Z]+/g);
  return latinMatch && latinMatch.join('').length > 3;
}).length;
console.log('Hebrew verses with Latin chars (after clean):', latinVerses);

// Save
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('\nSaved cleaned data to:', dataPath);

// Show sample
console.log('\n=== Sample verses after cleaning ===');
const samples = [
  { book: 'Genesis', chapter: 1, verse: 5 },
  { book: 'Genesis', chapter: 1, verse: 10 },
  { book: 'Psalms', chapter: 23, verse: 1 },
];

samples.forEach(s => {
  const v = data.verses.find(x => x.book === s.book && x.chapter === s.chapter && x.verse === s.verse);
  console.log('\n' + s.book + ' ' + s.chapter + ':' + s.verse);
  console.log('  Heb: ' + (v?.hebrewText?.substring(0, 60) || '(missing)'));
});
