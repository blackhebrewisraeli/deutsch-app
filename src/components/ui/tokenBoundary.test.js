import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const UI_DIR = 'src/components/ui';

// The layer below theme.js. A primitive that reads these is reading raw palette
// values, which re-introduces the light/dark branch that CSS custom properties
// exist to delete — every COLORS.* entry is already a var(--c-…) resolved on
// :root by applyTheme(), so a correct primitive contains no mode logic at all
// and the browser repaints on a mode change with no React involvement.
const FORBIDDEN_MODULES = ['themeTokens', 'applyTheme', 'themeMode'];

// The same rule, caught one level further in: a primitive that never imports a
// palette module but still branches on the mode has the same defect. Catching
// only the import would leave the actual prohibition — "no value chosen because
// of the mode" — unenforced.
const MODE_BRANCH = /\bmode\s*===\s*['"](?:dark|light)['"]|prefers-color-scheme/;

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      sources(full, out);
      continue;
    }
    if (/\.(jsx|js)$/.test(name) && !/\.test\.(jsx|js)$/.test(name)) out.push(full);
  }
  return out;
}

describe('ui primitives stay above the palette layer', () => {
  it('imports no palette module', () => {
    const files = sources(UI_DIR);
    // Denominator: an empty walk and a clean walk both report zero offenders.
    expect(files.length).toBeGreaterThan(5);

    const offenders = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/^\s*import\b/.test(line) && FORBIDDEN_MODULES.some((m) => line.includes(m))) {
            offenders.push(`${relative(UI_DIR, file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(
      offenders,
      `scanned ${files.length} files; palette-layer imports in ui/:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('branches on no theme mode', () => {
    const files = sources(UI_DIR);
    expect(files.length).toBeGreaterThan(5);

    const offenders = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (MODE_BRANCH.test(line)) {
            offenders.push(`${relative(UI_DIR, file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(
      offenders,
      `scanned ${files.length} files; mode branches in ui/:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  // Both controls. A walk that silently stops finding files, or a matcher that
  // stops matching, reports exactly the same "0 offenders" as a clean tree.
  it('would catch a palette import and a mode branch if one appeared', () => {
    const importLine = "import { MODE_COLORS } from '../../lib/themeTokens';";
    expect(
      /^\s*import\b/.test(importLine) && FORBIDDEN_MODULES.some((m) => importLine.includes(m))
    ).toBe(true);

    expect(MODE_BRANCH.test("  background: mode === 'dark' ? a : b,")).toBe(true);
    expect(MODE_BRANCH.test('  @media (prefers-color-scheme: dark)')).toBe(true);

    // …and would not fire on the correct way to write the same thing.
    expect(MODE_BRANCH.test('  background: COLORS.surface,')).toBe(false);
    const okImport = "import { COLORS, RADIUS } from '../../lib/theme';";
    expect(FORBIDDEN_MODULES.some((m) => okImport.includes(m))).toBe(false);
  });
});
