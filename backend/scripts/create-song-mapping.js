/**
 * Create Song Mapping Table
 * Links SoluFlow songs to SoluPresenter songs
 */

const fs = require('fs');
const path = require('path');

const data = require('./song-matches.json');

// Combine high and medium confidence matches
const approvedMatches = [
  ...data.highConfidence,
  ...data.mediumConfidence
];

// Create mapping object
const songMapping = {
  created: new Date().toISOString(),
  description: 'Mapping between SoluFlow and SoluPresenter songs',
  stats: {
    highConfidence: data.highConfidence.length,
    mediumConfidence: data.mediumConfidence.length,
    total: approvedMatches.length
  },
  mappings: approvedMatches.map(m => ({
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
  }))
};

// Save mapping file
const outputPath = path.join(__dirname, 'song-mapping.json');
fs.writeFileSync(outputPath, JSON.stringify(songMapping, null, 2));

console.log('Song Mapping Created!');
console.log('=====================');
console.log(`High confidence: ${songMapping.stats.highConfidence}`);
console.log(`Medium confidence: ${songMapping.stats.mediumConfidence}`);
console.log(`Total mappings: ${songMapping.stats.total}`);
console.log(`\nSaved to: ${outputPath}`);

// Also create a simple lookup object (flowId -> presenterId)
const lookupByFlowId = {};
const lookupByPresenterId = {};

approvedMatches.forEach(m => {
  lookupByFlowId[m.flowSong.id] = m.presenterSong.id;
  lookupByPresenterId[m.presenterSong.id] = m.flowSong.id;
});

const lookupPath = path.join(__dirname, 'song-mapping-lookup.json');
fs.writeFileSync(lookupPath, JSON.stringify({
  flowToPresenter: lookupByFlowId,
  presenterToFlow: lookupByPresenterId
}, null, 2));

console.log(`Lookup file saved to: ${lookupPath}`);
