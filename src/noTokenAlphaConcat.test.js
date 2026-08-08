import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest runs from the repo root — avoid `process` (ESLint browser globals).
// Lives at the src/ root, not under components/, because it guards all of src/:
// style objects are built in src/lib/ too, not only in components.
const SRC_DIR = 'src';

// After theme tokens became CSS variables, `COLORS.ink + '30'` produces the
// invalid `var(--c-fg)30`, which the browser silently drops. Alpha companions
// are named tokens (inkA30, etc.). Mirrors noHardcodedHex.test.js — a
// source-level guard, not a runtime check.
//
// Both spellings of the same bug are matched: the `+` concatenation and the
// template literal `${COLORS.ink}30`. The template form was invisible to this
// guard until T6 and is exactly as broken.
const TOKEN_ALPHA_CONCAT =
  /COLORS\.\w+\s*\+\s*['"`][0-9a-fA-F]{2}['"`]|['"`][0-9a-fA-F]{2}['"`]\s*\+\s*COLORS\.\w+|\$\{\s*COLORS\.\w+\s*\}[0-9a-fA-F]{2}\b/;

// Both extensions: .jsx for components, .js for the style/token modules in
// src/lib. Tests are excluded — they may assert resolved values.
function walkSource(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkSource(full, out);
      continue;
    }
    if (!/\.jsx?$/.test(name)) continue;
    if (/\.test\.jsx?$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

describe('no CSS-variable + hex-alpha concatenation', () => {
  it('fails if any source file under src/ concatenates a hex alpha onto a COLORS token', () => {
    const files = walkSource(SRC_DIR);
    const offenders = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // Allow the explanatory comment in MessageBubble that documents the ban.
        if (line.includes('Appending') || line.trimStart().startsWith('//')) return;
        if (TOKEN_ALPHA_CONCAT.test(line)) {
          offenders.push(`${relative(SRC_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, `token+alpha concat:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('covers src/lib and other non-component source, not just src/components', () => {
    const files = walkSource(SRC_DIR).map((f) => f.replace(/\\/g, '/'));
    expect(files).toContain('src/lib/theme.js');
    expect(files.some((f) => f.startsWith('src/components/'))).toBe(true);
    // .js is walked, not only .jsx — style objects live in plain modules too.
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);
  });

  it('excludes test files, which may assert resolved values', () => {
    const files = walkSource(SRC_DIR);
    expect(files.filter((f) => /\.test\.jsx?$/.test(f))).toEqual([]);
  });

  it('catches both spellings and leaves the named alpha tokens alone', () => {
    // The `+` form.
    expect(TOKEN_ALPHA_CONCAT.test("background: COLORS.ink + '30'")).toBe(true);
    expect(TOKEN_ALPHA_CONCAT.test('background: COLORS.ink + "aa"')).toBe(true);
    expect(TOKEN_ALPHA_CONCAT.test("background: '30' + COLORS.ink")).toBe(true);
    // The template-literal form — same bug, previously unguarded.
    expect(TOKEN_ALPHA_CONCAT.test('background: `${COLORS.ink}30`')).toBe(true);
    expect(TOKEN_ALPHA_CONCAT.test('background: `${ COLORS.paper }aa`')).toBe(true);
    // The correct spelling, and a template that interpolates without an alpha.
    expect(TOKEN_ALPHA_CONCAT.test('background: COLORS.inkA30')).toBe(false);
    expect(TOKEN_ALPHA_CONCAT.test('border: `2px solid ${COLORS.ink}`')).toBe(false);
  });
});
