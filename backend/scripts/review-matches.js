const data = require('./song-matches.json');

console.log('='.repeat(100));
console.log('HIGH CONFIDENCE MATCHES (90%+) - ' + data.highConfidence.length + ' songs');
console.log('='.repeat(100));
console.log('');
console.log('#   | Score | SoluFlow Title                          | SoluPresenter Title');
console.log('-'.repeat(100));

data.highConfidence.forEach((m, i) => {
  const num = String(i + 1).padStart(3);
  const score = String(m.overallScore).padStart(3);
  const flowTitle = m.flowSong.title.substring(0, 38).padEnd(38);
  const presTitle = m.presenterSong.title.substring(0, 38);
  console.log(`${num} | ${score}% | ${flowTitle} | ${presTitle}`);
});

console.log('');
console.log('='.repeat(100));
console.log('MEDIUM CONFIDENCE MATCHES (70-89%) - ' + data.mediumConfidence.length + ' songs');
console.log('='.repeat(100));
console.log('');
console.log('#   | Score | SoluFlow Title                          | SoluPresenter Title');
console.log('-'.repeat(100));

data.mediumConfidence.forEach((m, i) => {
  const num = String(i + 1).padStart(3);
  const score = String(m.overallScore).padStart(3);
  const flowTitle = m.flowSong.title.substring(0, 38).padEnd(38);
  const presTitle = m.presenterSong.title.substring(0, 38);
  console.log(`${num} | ${score}% | ${flowTitle} | ${presTitle}`);
});
