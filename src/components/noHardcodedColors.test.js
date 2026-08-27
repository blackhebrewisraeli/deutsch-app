import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// vitest runs from the repo root — avoid `process` (ESLint browser globals).
const COMPONENTS_DIR = 'src/components';

// CSS named colours someone might plausibly type by hand.
const NAMED = 'white|black|red|green|blue|grey|gray|orange|purple|yellow';

// Hex in any length, plus the functional notations and the CSS named colours.
// A hex-only guard let `rgba(0,0,0,.5)` and `white` through, and it skipped .js
// files entirely — both holes are why this file is no longer called
// noHardcodedHex.
//
// `transparent` and `currentColor` are deliberately absent: they are relative,
// not absolute, and follow the theme.
//
// The named-colour patterns are deliberately NARROW — a whole quoted value, or
// a border/outline shorthand. The obvious `\b(red|green|…)\b` matches
// `COLORS.red,` and `COLORS.green,` on 8+ legitimate lines, plus the word "red"
// in a prose comment. A guard that fires on correct code is worse than no
// guard: it gets weakened or deleted. These two forms are how a named colour
// actually gets written, and they match nothing in the tree today.
//
// There is no separate `color-mix()` pattern: a color-mix over a literal
// contains that literal, so patterns 1, 3 and 4 already catch it, while
// color-mix over a `var(--…)` is legitimate and must not be flagged.
const COLOR = new RegExp(
  [
    '#[0-9a-fA-F]{3,8}\\b', // #rgb / #rrggbb / #rrggbbaa
    '\\b(?:rgba?|hsla?)\\s*\\(', // rgb() rgba() hsl() hsla()
    `['"](?:${NAMED})['"]`, // color: 'white'
    `\\b(?:solid|dashed|dotted)\\s+(?:${NAMED})\\b`, // '1px solid white'
  ].join('|')
);

// Comments are stripped before matching, and the reason is `#109`: this repo
// references PRs by number constantly ("see #109", "shipped as #104"), and
// `#109` is three valid hex digits, so it matches the hex pattern exactly like
// `#fff` does. There is no way to tell a colour from an issue reference by
// shape alone — but a colour literal in a comment is inert, so dropping comment
// text costs the guard nothing and removes the whole class of false positive.
//
// The `[^:]` guard on the line-comment rule keeps `https://…` intact; without
// it every URL truncates its own line and blinds the guard after it.
function stripComments(line) {
  const trimmed = line.trim();
  // Continuation line of a block comment: ` * Gold matches (#FFCE00)`.
  if (trimmed.startsWith('*')) return '';
  return line
    .replace(/\/\*.*?\*\//g, '') // /* inline */ and {/* jsx */}
    .replace(/(^|[^:])\/\/.*$/, '$1'); // // to end of line, but not http://
}

/** The one predicate: comment-stripped line contains an absolute colour. */
function hasColorLiteral(line) {
  return COLOR.test(stripComments(line));
}

function walkSources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkSources(full, out);
      continue;
    }
    // Component sources only — tests may assert resolved values. Both .jsx and
    // .js: five non-test .js files under src/components were unscanned before.
    if (/\.(jsx|js)$/.test(name) && !/\.test\.(jsx|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('no hardcoded colours in components', () => {
  it('fails if any non-test source under src/components contains a colour literal', () => {
    const files = walkSources(COMPONENTS_DIR);
    // Print the denominator: "0 offenders" and "0 files scanned" otherwise
    // print identically, and a guard that walks nothing passes forever.
    expect(files.length).toBeGreaterThan(50);

    const offenders = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (hasColorLiteral(line)) {
          offenders.push(`${relative(COMPONENTS_DIR, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `scanned ${files.length} files; hardcoded colour literals:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  // Both controls, because a stripper that is too eager is indistinguishable
  // from a guard that works: everything stays green while coverage goes to zero.
  it('ignores colour-shaped text in comments', () => {
    expect(hasColorLiteral('// correct answer wrong — see #109.')).toBe(false);
    expect(hasColorLiteral('  * Gold matches the pack accent fill (`#FFCE00`)')).toBe(false);
    expect(hasColorLiteral('const x = 1; /* was #FF0000 */')).toBe(false);
    expect(hasColorLiteral('{/* the red dot, #DD0000 */}')).toBe(false);
  });

  it('still catches every literal form in real code', () => {
    expect(hasColorLiteral("  color: '#FFCE00',")).toBe(true);
    expect(hasColorLiteral('  background: `#fff`,')).toBe(true);
    expect(hasColorLiteral('  background: rgba(0, 0, 0, 0.5),')).toBe(true);
    expect(hasColorLiteral('  outline: hsl(210 100% 50%),')).toBe(true);
    expect(hasColorLiteral("  color: 'white',")).toBe(true);
    expect(hasColorLiteral("  border: '1px solid white',")).toBe(true);
  });

  it('does not fire on token usage, URLs, or permitted keywords', () => {
    // The naive \\b(red|green)\\b rule matched these on 8+ legitimate lines.
    expect(hasColorLiteral('  color: COLORS.red,')).toBe(false);
    expect(hasColorLiteral('  background: COLORS.green,')).toBe(false);
    expect(hasColorLiteral('  const PIECE = [COLORS.red, COLORS.gold];')).toBe(false);
    // A URL must not truncate its own line and blind the rest of it.
    expect(hasColorLiteral("  const u = 'https://x.dev'; const c = '#FFCE00';")).toBe(true);
    // Relative colours follow the theme and are allowed.
    expect(hasColorLiteral("  background: 'transparent',")).toBe(false);
    expect(hasColorLiteral("  border: '2px solid currentColor',")).toBe(false);
    expect(
      hasColorLiteral('  background: color-mix(in srgb, var(--c-accent) 70%, transparent),')
    ).toBe(false);
  });

  // The walk is the half most likely to rot silently: a future refactor that
  // moves primitives into a new subdirectory, or renames an extension, would
  // shrink the denominator while the suite stays green.
  it('reaches into subdirectories and covers .js as well as .jsx', () => {
    const files = walkSources(COMPONENTS_DIR).map((f) => relative(COMPONENTS_DIR, f));
    expect(files).toContain('ui/Confetti.jsx'); // nested .jsx
    expect(files).toContain('vocab/drills.js'); // nested .js — invisible to the old guard
    expect(files.some((f) => f.endsWith('.test.js') || f.endsWith('.test.jsx'))).toBe(false);
  });
});
