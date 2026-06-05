// Generates PWA icons from the SVG base using sharp.
// sharp is NOT a permanent dev dependency — install it first, then run this script:
//   npm install -D sharp
//   node scripts/gen-icons.js
// The generated PNGs are committed to public/ so you only need to re-run
// this if you change public/icon-base.svg.
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svg = readFileSync(join(root, 'public/icon-base.svg'));

const icons = [
  { size: 192, file: 'pwa-192.png' },
  { size: 512, file: 'pwa-512.png' },
  { size: 180, file: 'apple-touch-icon.png' },
  { size: 32,  file: 'favicon-32.png' },
];

for (const { size, file } of icons) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(root, 'public', file));
  console.log(`✓ ${file} (${size}×${size})`);
}
