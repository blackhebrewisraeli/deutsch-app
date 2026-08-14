// Vendors the active pack's fonts into public/fonts/ so the app serves its own
// typography. Run: `npm run vendor:fonts`
//
// Idempotent: re-running with an unchanged pack rewrites identical bytes.
// The written manifest records the resolved upstream URL, sha256 and size of
// every file, so a later re-run that produces different bytes is visible in the
// diff rather than silent.

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activePack } from '../../src/packs/index.js';
import { buildGoogleFontsUrl, familySlug } from './googleFontsUrl.js';
import { parseFaces, renderFaceCss, localFileName } from './css.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'public', 'fonts');

// css2 content-negotiates on User-Agent: the default Node UA is served TTF,
// with a 200 and no hint that anything is wrong. Ask as a current browser.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Self-hosting makes us the redistributor, and OFL 1.1 permits that only if the
// licence travels with the files. Keyed by family so a pack that adds a face
// cannot quietly skip it — an unlisted family is a hard failure below.
const LICENSES = {
  Fraunces: 'https://raw.githubusercontent.com/undercasetype/Fraunces/master/OFL.txt',
  'JetBrains Mono': 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt',
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  return res.text();
}

async function fetchBytes(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function vendorFonts({ out = OUT, pack = activePack, log = console.log } = {}) {
  const { families, subsets } = pack.theme.font;
  if (!Array.isArray(families) || families.length === 0) {
    throw new Error('pack declares no font families');
  }
  if (!Array.isArray(subsets) || subsets.length === 0) {
    throw new Error('pack declares no font subsets — refusing to guess');
  }

  const missing = families.map((f) => f.name).filter((n) => !LICENSES[n]);
  if (missing.length) {
    throw new Error(`no licence source recorded for: ${missing.join(', ')}. Add it to LICENSES.`);
  }

  const url = buildGoogleFontsUrl(families);
  log(`css2  ${url}`);
  const css = await fetchText(url);
  if (!css.includes('woff2')) {
    throw new Error('css2 returned no woff2 — the User-Agent was not accepted');
  }

  const all = parseFaces(css);
  const wanted = all.filter((f) => subsets.includes(f.subset));
  if (wanted.length === 0) {
    throw new Error(`no faces matched subsets ${subsets.join(', ')}`);
  }
  log(`faces ${all.length} returned, ${wanted.length} kept (${subsets.join(', ')})`);

  // Rebuilt from scratch so a family or subset dropped from the pack cannot
  // leave an orphan file behind that the precache would still ship.
  if (existsSync(out)) rmSync(out, { recursive: true });
  mkdirSync(out, { recursive: true });

  const manifest = { generatedFrom: url, subsets, families: {} };
  let total = 0;

  for (const family of families) {
    const slug = familySlug(family.name);
    const dir = join(out, slug);
    mkdirSync(dir, { recursive: true });

    const faces = wanted
      .filter((f) => f.family === family.name)
      .map((f) => ({ ...f, localName: localFileName(f, slug) }));
    if (faces.length === 0) throw new Error(`css2 returned no faces for ${family.name}`);

    const files = [];
    for (const face of faces) {
      const bytes = await fetchBytes(face.url);
      writeFileSync(join(dir, face.localName), bytes);
      total += bytes.length;
      files.push({
        file: face.localName,
        subset: face.subset,
        weight: face.weight,
        style: face.style,
        from: face.url,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }

    writeFileSync(join(dir, 'face.css'), renderFaceCss(faces, `/fonts/${slug}`));
    writeFileSync(join(dir, 'OFL.txt'), await fetchText(LICENSES[family.name]));

    manifest.families[family.name] = { slug, axes: family.axes ?? null, files };
    const kb = (files.reduce((a, f) => a + f.bytes, 0) / 1024).toFixed(1);
    log(`  ${family.name.padEnd(16)} ${String(files.length).padStart(2)} files  ${kb} KB`);
  }

  manifest.totalBytes = total;
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  log(`total ${(total / 1024).toFixed(1)} KB into ${out}`);
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  vendorFonts().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
