const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Files to convert
const pngFiles = [
  'resources/icons/cast_logo.png',
  'resources/icons/new_cast_logo.png',
  'resources/icons/logo512.png',
  'src/renderer/assets/logo.png'
];

async function convertToCyan(inputPath) {
  const fullPath = path.join(__dirname, '..', inputPath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${inputPath} - file not found`);
    return;
  }

  console.log(`Converting ${inputPath}...`);

  // Backup original
  const backupPath = fullPath + '.backup';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(fullPath, backupPath);
  }

  // Apply hue rotation: orange is ~30deg, cyan is ~180deg, so rotate by 150deg
  // sharp's modulate hue is in degrees (-180 to 180)
  await sharp(fullPath)
    .modulate({
      hue: 160,  // Rotate hue by 160 degrees (orange -> cyan)
      saturation: 1.1  // Slightly boost saturation
    })
    .toFile(fullPath + '.tmp');

  // Replace original with converted
  fs.unlinkSync(fullPath);
  fs.renameSync(fullPath + '.tmp', fullPath);

  console.log(`  Done: ${inputPath}`);
}

async function main() {
  console.log('Converting icons from orange to cyan...\n');

  for (const file of pngFiles) {
    try {
      await convertToCyan(file);
    } catch (err) {
      console.error(`Error converting ${file}:`, err.message);
    }
  }

  console.log('\nPNG files converted!');
  console.log('\nTo regenerate ICO files, rebuild the app with: npm run build');
  console.log('Or use png-to-ico package to convert logo512.png to favicon.ico');
}

main();
