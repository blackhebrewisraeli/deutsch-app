// Generates PWA icons from the SVG base using sharp.
// Run once: node scripts/gen-icons.js
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
