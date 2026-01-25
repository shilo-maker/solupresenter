const matchData = require('./song-matches.json');
const mapping = require('./song-mapping.json');

// Get all already mapped flow IDs
const mappedFlowIds = new Set(mapping.mappings.map(m => m.soluflow.id));

// Find remaining unmatched from lowConfidence
const remaining = matchData.lowConfidence.filter((m, i) => !mappedFlowIds.has(m.flowSong.id));

console.log('REMAINING LOW CONFIDENCE MATCHES (not yet approved)');
console.log('='.repeat(90));
console.log('');
console.log('#   | Score | SoluFlow Title                          | SoluPresenter Title');
console.log('-'.repeat(90));

remaining.forEach((m, i) => {
  const num = String(i + 1).padStart(3);
  const score = String(m.overallScore).padStart(3);
  const flowTitle = m.flowSong.title.substring(0, 38).padEnd(38);
  const presTitle = m.presenterSong.title.substring(0, 38);
  console.log(`${num} | ${score}% | ${flowTitle} | ${presTitle}`);
});

console.log('');
console.log(`Total remaining: ${remaining.length}`);
