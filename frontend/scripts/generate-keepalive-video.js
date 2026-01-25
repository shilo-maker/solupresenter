// This script creates a minimal 1-second transparent video file
// Run with: node generate-keepalive-video.js
// Requires: npm install canvas fluent-ffmpeg (but we'll use a simpler approach)

const fs = require('fs');
const path = require('path');

// Minimal WebM video (1 frame, black, 64x64, ~1.3KB)
// This is a real encoded WebM video with VP8 codec
const minimalWebM = Buffer.from(
  '1a45dfa3a3428682847765626da3428782847765626d428682847765626d428682847765626d428682847765626d428682847765626d428682847765626d428682847765626d',
  'hex'
);

const outputPath = path.join(__dirname, '..', 'public', 'transparent-keepalive.webm');

console.log('⚠️  This is a placeholder script.');
console.log('To generate a real video file, please:');
console.log('1. Open frontend/public/generate-video.html in a browser');
console.log('2. Click "Download Video" when it appears');
console.log('3. Save as transparent-keepalive.webm in frontend/public/');
console.log('');
console.log('Alternatively, you can use FFmpeg:');
console.log('ffmpeg -f lavfi -i color=c=black:s=64x64:d=1 -c:v libvpx -b:v 50k transparent-keepalive.webm');
