/**
 * Test Quick Slide API
 */

const http = require('http');

const testText = 'ורואה';

const postData = JSON.stringify({ text: testText });

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/quick-slide/process',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing Quick Slide API...');
console.log('Input text:', testText);
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('Response:');
      console.log('  Original:', result.original);
      console.log('  Transliteration:', result.transliteration);
      console.log('  Translation:', result.translation);
      console.log('  Translation Source:', result.translationSource);
      console.log('  Is Hebrew:', result.isHebrew);
      console.log('  Stats:', JSON.stringify(result.stats));
      if (result.translationError) {
        console.log('  Translation Error:', result.translationError);
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
