#!/usr/bin/env node
/**
 * Prepares a folder of property photos for the site:
 *
 *   npm run photos -- <slug> <source-folder>
 *
 * For each image in <source-folder> (sorted by filename, numbers in natural
 * order) it writes public/photos/<slug>/<name>.jpg:
 *   - rotated upright per the camera's orientation tag,
 *   - at most 2560px on the long edge (next/image makes the smaller sizes),
 *   - re-encoded as a progressive JPEG (quality 82),
 *   - with ALL metadata removed — including GPS coordinates, which would
 *     otherwise reveal each property's exact location to anyone who
 *     downloads a photo from /public.
 *
 * It then prints a `photos: [...]` list to paste into the property's entry in
 * src/data/properties.ts. Reorder that list to control the display order;
 * the first five are the stay page's photo grid.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT_TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);
const MAX_EDGE = 2560;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const [slug, source] = process.argv.slice(2);
if (!slug || !source) fail('Usage: npm run photos -- <slug> <source-folder>');
if (!/^[a-z0-9-]+$/.test(slug)) fail(`"${slug}" isn't a valid slug.`);

const dataFile = await fs.readFile(path.join(ROOT, 'src/data/properties.ts'), 'utf8');
if (!dataFile.includes(`slug: '${slug}'`)) fail(`No property with slug "${slug}" in src/data/properties.ts.`);

const sourceDir = path.resolve(source);
const targetDir = path.join(ROOT, 'public/photos', slug);
if (sourceDir === targetDir) fail('Pick a source folder outside public/photos/ — originals are never overwritten.');

let entries;
try {
  entries = await fs.readdir(sourceDir, { withFileTypes: true });
} catch {
  fail(`Can't read ${sourceDir}`);
}

const files = entries
  .filter((e) => e.isFile() && !e.name.startsWith('.'))
  .map((e) => e.name)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

const skipped = files.filter((f) => !INPUT_TYPES.has(path.extname(f).toLowerCase()));
const images = files.filter((f) => INPUT_TYPES.has(path.extname(f).toLowerCase()));
if (!images.length) fail(`No JPEG/PNG/WebP images in ${sourceDir}.`);

/** "IMG 0042 (Pool).JPG" → "img-0042-pool" */
const cleanName = (file) =>
  path
    .basename(file, path.extname(file))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'photo';

await fs.mkdir(targetDir, { recursive: true });

const used = new Set();
const written = [];
let bytesIn = 0;
let bytesOut = 0;

for (const file of images) {
  let name = cleanName(file);
  for (let n = 2; used.has(name); n++) name = `${cleanName(file)}-${n}`;
  used.add(name);
  const outName = `${name}.jpg`;
  const input = path.join(sourceDir, file);
  const output = path.join(targetDir, outName);

  try {
    const info = await sharp(input)
      .rotate() // apply EXIF orientation, then drop it with the rest of the metadata
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toFile(output); // sharp writes no metadata unless asked to
    const inSize = (await fs.stat(input)).size;
    bytesIn += inSize;
    bytesOut += info.size;
    written.push(outName);
    console.log(`  ✓ ${file} → ${outName}  ${info.width}×${info.height}  ${(inSize / 1e6).toFixed(1)} MB → ${(info.size / 1e6).toFixed(2)} MB`);
  } catch (err) {
    console.log(`  ✗ ${file}: ${err.message.split('\n')[0]}`);
    skipped.push(file);
  }
}

console.log(`\n${written.length} photo(s) written to public/photos/${slug}/ (${(bytesIn / 1e6).toFixed(1)} MB → ${(bytesOut / 1e6).toFixed(1)} MB)`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length}: ${skipped.join(', ')}`);
  console.log('HEIC (iPhone) photos need exporting as JPEG first.');
}
console.log(`\nPaste into the "${slug}" entry in src/data/properties.ts, then reorder (first 5 = photo grid):\n`);
console.log(`    photos: [\n${written.map((f) => `      '${f}',`).join('\n')}\n    ],\n`);
