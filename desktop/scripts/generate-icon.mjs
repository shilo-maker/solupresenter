import sharp from 'sharp';
import toIco from 'to-ico';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, '..', 'resources');
const iconsDir = join(resourcesDir, 'icons');

const sourcePng = join(iconsDir, 'cast_logo.png');
const outputIco = join(resourcesDir, 'icon.ico');
const outputFavicon = join(iconsDir, 'favicon.ico');

// Windows needs these sizes for proper display everywhere
const sizes = [16, 24, 32, 48, 64, 128, 256];

async function generateIco() {
  console.log('Generating icon from:', sourcePng);

  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(sourcePng)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  console.log('Generated PNG buffers for sizes:', sizes.join(', '));

  const icoBuffer = await toIco(pngBuffers);

  writeFileSync(outputIco, icoBuffer);
  console.log('Written:', outputIco);

  writeFileSync(outputFavicon, icoBuffer);
  console.log('Written:', outputFavicon);

  console.log('Done! Icon size:', icoBuffer.length, 'bytes');
}

generateIco().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
