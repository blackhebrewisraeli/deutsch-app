// Filesystem reader for the dev toolkit: walk roots, return { path: source }
// for source files. The only fs-touching piece — moduleGraph stays pure.
import { readdirSync, readFileSync } from 'node:fs';

const SRC_EXT = /\.(jsx?|mjs|tsx?)$/;
const TEST_RE = /\.test\.(jsx?|mjs|tsx?)$/;

export function collectSources(roots = ['src', 'api'], { includeTests = true } = {}) {
  const files = {};
  for (const root of roots) walk(root, files, includeTests);
  return files;
}

function walk(dir, files, includeTests) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // missing root → skip silently
  }
  for (const e of entries) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(p, files, includeTests);
    } else if (SRC_EXT.test(e.name)) {
      if (!includeTests && TEST_RE.test(e.name)) continue;
      files[p] = readFileSync(p, 'utf8');
    }
  }
}
