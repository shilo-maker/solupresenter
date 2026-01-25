/**
 * Add approved questionable matches to the mapping
 */

const fs = require('fs');
const path = require('path');

const matchData = require('./song-matches.json');
const existingMapping = require('./song-mapping.json');

// Indices of approved questionable matches (0-based from the 54-item lowConfidence array)
// User approved: #6, 7, 9, 17, 18, 19, 26, 27, 30, 32, 37, 41, 42, 49, 50, 52, 53
const approvedIndices = [
  5,   // #6: אשא עיני אל השמיים ↔ הושיע את עמך
  6,   // #7: ברוך אתה אדוני(נהלל אותך אדון) ↔ נהלל אותך אדון
  8,   // #9: שנה את חיי ↔ ישוע לך ישוע (שנה את חיי)
  16,  // #17: כי אהבת אותי ראשון ↔ בכל דבר שאעשה
  17,  // #18: רוח בואי פחי באנו ↔ המנון כנס ציון
  18,  // #19: ממעמקים ↔ מי יעמוד מולך
  25,  // #26: קח כבוד ↔ שים בי את האש
  26,  // #27: גדול אתה וקדוש שמך ↔ קדוש שמך לעד
  29,  // #30: נכון ליבי ↔ רומה
  31,  // #32: גדול אדוני(הללויה) ↔ גדול אדוני ומהולל מאוד
  36,  // #37: אשירה לאדוני(ואני אני בחסדך בטחתי) ↔ אשירה לאדוני
  40,  // #41: רם ונישא כי ראוי אתה(אתה קדוש) ↔ רם ונישא(מהיר)
  41,  // #42: לכו נרננה לה' ↔ לכו נרננה (מקדם)
  48,  // #49: גול על אדוני ↔ גול על אדוני דרכך
  49,  // #50: אבא ↔ אתה
  51,  // #52: אלוהי השמיים ↔ אין שינוי בו
  52   // #53: ברוך אתה אדוני(לך הגדולה) ↔ ברוך אתה אדוני(קלאסי)
];

// Get the approved matches
const approvedQuestionable = approvedIndices.map(i => matchData.lowConfidence[i]).filter(Boolean);

// Remove duplicates
const seenFlowIds = new Set(existingMapping.mappings.map(m => m.soluflow.id));
const uniqueApproved = [];

approvedQuestionable.forEach(m => {
  if (!seenFlowIds.has(m.flowSong.id)) {
    seenFlowIds.add(m.flowSong.id);
    uniqueApproved.push(m);
  }
});

console.log(`Adding ${uniqueApproved.length} new questionable (now approved) matches`);

// Show what we're adding
console.log('\nApproved matches:');
uniqueApproved.forEach(m => {
  console.log(`  ${m.overallScore}% | ${m.flowSong.title} ↔ ${m.presenterSong.title}`);
});

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
existingMapping.stats.questionableApproved = (existingMapping.stats.questionableApproved || 0) + uniqueApproved.length;
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
console.log(`Questionable (approved): ${existingMapping.stats.questionableApproved}`);
console.log(`Total mappings: ${existingMapping.stats.total}`);
