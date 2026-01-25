/**
 * Add approved low confidence matches to the mapping
 */

const fs = require('fs');
const path = require('path');

const matchData = require('./song-matches.json');
const existingMapping = require('./song-mapping.json');

// Indices of approved low confidence matches (0-based)
const approvedIndices = [
  1, 2, 3, 4,       // #2-5: כוס ישועות, רב להושיע, כמה טוב אתה, כי כה אהב
  7,                // #8: מי לא יראך אדוני
  9, 10, 11, 12, 13, // #10-14: כאייל צמא, מתן תודה, רוח אדוני עלי, כוח בדם, קומי אורי
  15,               // #16: לא לנו
  19, 20, 21, 22, 23, 24, // #20-25: עוזך אהבתך, בליבי צפנתי, אתה ראוי להכל, שלום שלום, השמיים מספרים, אתה מולך
  27, 28,           // #28-29: בשם אדוני, שמע ישראל (מהיר)
  30,               // #31: מעל הכל
  32, 33,           // #33-34: אני נופל על פני, אני יודע
  34, 35,           // #35-36: מי כמוך באלים, הודו לאדוני כי טוב(מהיר)
  37, 38, 39,       // #38-40: גדולים ונפלאים, שמך כדבש, הכל עבורך
  42, 43,           // #43-44: קול רינה, הודו לאדוני כי טוב(קלאסי)
  44, 45,           // #45-46: אביר ישראל, אין שם אחר
  47,               // #48: גדול אלוהי
  53                // #54: שמע ישראל (ישן)
];

// Get the approved matches
const approvedLowConfidence = approvedIndices.map(i => matchData.lowConfidence[i]).filter(Boolean);

// Remove duplicates (in case any index was listed twice)
const uniqueApproved = [];
const seenFlowIds = new Set(existingMapping.mappings.map(m => m.soluflow.id));

approvedLowConfidence.forEach(m => {
  if (!seenFlowIds.has(m.flowSong.id)) {
    seenFlowIds.add(m.flowSong.id);
    uniqueApproved.push(m);
  }
});

console.log(`Adding ${uniqueApproved.length} new approved low confidence matches`);

// Add to existing mapping
const newMappings = uniqueApproved.map(m => ({
  soluflow: {
    id: m.flowSong.id,
    title: m.flowSong.title
  },
  solupresenter: {
    id: m.presenterSong.id,
    title: m.presenterSong.title
  },
  confidence: m.overallScore,
  titleMatch: m.titleSimilarity,
  lyricsMatch: m.lyricsSimilarity
}));

existingMapping.mappings.push(...newMappings);
existingMapping.stats.lowConfidenceApproved = uniqueApproved.length;
existingMapping.stats.total = existingMapping.mappings.length;
existingMapping.updated = new Date().toISOString();

// Save updated mapping
const outputPath = path.join(__dirname, 'song-mapping.json');
fs.writeFileSync(outputPath, JSON.stringify(existingMapping, null, 2));

// Update lookup file
const lookupByFlowId = {};
const lookupByPresenterId = {};

existingMapping.mappings.forEach(m => {
  lookupByFlowId[m.soluflow.id] = m.solupresenter.id;
  lookupByPresenterId[m.solupresenter.id] = m.soluflow.id;
});

const lookupPath = path.join(__dirname, 'song-mapping-lookup.json');
fs.writeFileSync(lookupPath, JSON.stringify({
  flowToPresenter: lookupByFlowId,
  presenterToFlow: lookupByPresenterId
}, null, 2));

console.log('\nMapping Updated!');
console.log('================');
console.log(`High confidence: ${existingMapping.stats.highConfidence}`);
console.log(`Medium confidence: ${existingMapping.stats.mediumConfidence}`);
console.log(`Low confidence (approved): ${existingMapping.stats.lowConfidenceApproved}`);
console.log(`Total mappings: ${existingMapping.stats.total}`);
