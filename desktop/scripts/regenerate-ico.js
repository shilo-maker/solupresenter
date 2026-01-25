const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const path = require('path');
const fs = require('fs');

async function generateIco() {
  // Use the circular logo as source
  const sourceImage = path.join(__dirname, '..', 'resources', 'icons', 'cast_logo.png');
  const outputIco = path.join(__dirname, '..', 'resources', 'icon.ico');
  const outputFaviconIco = path.join(__dirname, '..', 'resources', 'icons', 'favicon.ico');

  console.log('Source image:', sourceImage);
  console.log('Output ICO:', outputIco);

  // Create temp PNG files at required sizes for Windows icons
  const sizes = [16, 32, 48, 64, 128, 256];
  const tempFiles = [];

  for (const size of sizes) {
    const tempFile = path.join(__dirname, `temp_${size}.png`);
    console.log(`Generating ${size}x${size}...`);

    await sharp(sourceImage)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(tempFile);

    tempFiles.push(tempFile);
  }

  console.log('Converting to ICO using png-to-ico...');
  const icoBuffer = await pngToIco(tempFiles);

  // Write to both locations
  fs.writeFileSync(outputIco, icoBuffer);
  fs.writeFileSync(outputFaviconIco, icoBuffer);

  // Cleanup temp files
  for (const tempFile of tempFiles) {
    fs.unlinkSync(tempFile);
  }

  console.log('Done! ICO files generated:');
  console.log(' -', outputIco);
  console.log(' -', outputFaviconIco);
  console.log('Size:', icoBuffer.length, 'bytes');
}

generateIco().catch(console.error);
