import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Safe-area handling has two halves, in two different files, and either half
// alone is silently wrong:
//
//   1. index.html's viewport meta must carry `viewport-fit=cover`. Without it
//      iOS reports every env(safe-area-inset-*) as 0 — in Mobile Safari and
//      inside the installed PWA alike (vite.config.js sets display:'standalone').
//   2. The layout must actually consume the insets.
//
// Ship (2) without (1) and you get dead code that reads as protective. Ship
// (1) without (2) and the sticky masthead slides under the Dynamic Island.
// This file asserts the biconditional AND the specific edges that must move.

// Relative paths, matching src/shellTheme.test.js: vitest runs from the repo
// root, and `process` is not a declared global for this eslint config.
const NEEDLE = 'env(safe-area-inset';
const SELF = 'safeArea.test.js';

/**
 * Strip comments so prose ABOUT the insets does not read as use OF them — every
 * file touched by this decision explains itself at length. Block comments first
 * (they cover the CSS-in-template-literal rules too), then line comments, and
 * `//` is only treated as one when it is not preceded by `:` so that a URL like
 * https://example.com does not swallow the rest of its line.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(jsx?|css)$/.test(entry) && entry !== SELF) {
      out.push(full);
    }
  }
  return out;
}

const viewport = readFileSync('index.html', 'utf8').match(
  /<meta\s+name="viewport"\s+content="([^"]*)"/
);

const optedIn = /viewport-fit\s*=\s*cover/.test(viewport?.[1] ?? '');

const scanned = sourceFiles('src');
const consumers = scanned.filter((f) => stripComments(readFileSync(f, 'utf8')).includes(NEEDLE));

describe('safe-area handling is all-or-nothing', () => {
  it('actually scanned the source tree', () => {
    expect(scanned.length, 'sourceFiles walked src/ and found nothing').toBeGreaterThan(100);
    expect(scanned).toContain(join('src', 'components', 'ui', 'Layout.jsx'));
  });

  it('finds the viewport meta at all', () => {
    expect(viewport, 'index.html has no parseable <meta name="viewport">').toBeTruthy();
  });

  it('opts the viewport into cover so iOS reports real insets', () => {
    expect(optedIn).toBe(true);
  });

  it('consumes inset-top on the sticky masthead, so the wordmark clears the notch', () => {
    const app = stripComments(readFileSync('src/App.jsx', 'utf8'));
    expect(app).toContain('safe-area-inset-top');
  });

  it('composes inset-bottom with the PageFrame gutter, never replacing it', () => {
    const layout = stripComments(readFileSync('src/components/ui/Layout.jsx', 'utf8'));
    expect(layout).toContain('safe-area-inset-bottom');
    expect(layout).toContain('safe-area-inset-left');
    expect(layout).toContain('safe-area-inset-right');
  });

  if (optedIn) {
    it('consumes the insets it opted into', () => {
      expect(
        consumers,
        'index.html opts into safe areas with viewport-fit=cover, but no source ' +
          'file consumes env(safe-area-inset-*). Content now renders under the ' +
          'notch and the home indicator.'
      ).not.toHaveLength(0);
    });
  } else {
    it('ships no inset that could only resolve to 0', () => {
      expect(
        consumers,
        "These files use env(safe-area-inset-*), but index.html's viewport meta " +
          'has no viewport-fit=cover, so iOS resolves every one of them to 0.\n  ' +
          consumers.join('\n  ')
      ).toEqual([]);
    });
  }
});
