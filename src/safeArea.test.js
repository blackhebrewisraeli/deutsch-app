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
// Ship (2) without (1) and you get dead code that reads as protective: that is
// exactly what this repo had — a PageFrame paddingBottom and an
// `.entry-screen-foot` rule that could never do anything. Ship (1) without (2)
// and you get a live regression: the App.jsx masthead is `position: sticky;
// top: 0`, so the viewport growing under the status bar slides the wordmark
// under the Dynamic Island, and the page gutters would need inset-left/right or
// landscape content runs under the notch.
//
// So this file asserts the biconditional rather than either side on its own.
// The app currently does NOT opt in; that is a deliberate decision, not an
// oversight, and flipping it is a real visual change that needs a notched
// device to verify.

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
  // Both of these guard the guard. "Nothing found" and "nothing looked at"
  // print identically, and a scan that silently walks an empty tree would let
  // this whole file pass for the wrong reason.
  it('actually scanned the source tree', () => {
    expect(scanned.length, 'sourceFiles walked src/ and found nothing').toBeGreaterThan(100);
    expect(scanned).toContain(join('src', 'components', 'ui', 'Layout.jsx'));
  });

  it('finds the viewport meta at all', () => {
    // Guards the guard: a renamed or reformatted meta tag would otherwise make
    // `optedIn` false forever and quietly turn this whole file into a no-op.
    expect(viewport, 'index.html has no parseable <meta name="viewport">').toBeTruthy();
  });

  if (optedIn) {
    it('consumes the insets it opted into', () => {
      expect(
        consumers,
        'index.html opts into safe areas with viewport-fit=cover, but no source ' +
          'file consumes env(safe-area-inset-*). Content now renders under the ' +
          'notch and the home indicator. At minimum: an inset-top on the sticky ' +
          'masthead in App.jsx, inset-left/right on the page gutters, and an ' +
          'inset-bottom composed with (not replacing) the bottom gutter.'
      ).not.toHaveLength(0);
    });
  } else {
    it('ships no inset that could only resolve to 0', () => {
      expect(
        consumers,
        "These files use env(safe-area-inset-*), but index.html's viewport meta " +
          'has no viewport-fit=cover, so iOS resolves every one of them to 0. ' +
          'Either add the opt-in (and handle the top and the inline edges too — ' +
          'see the PageFrame comment in src/components/ui/Layout.jsx), or drop ' +
          'the inset rather than leaving code that reads as protective:\n  ' +
          consumers.join('\n  ')
      ).toEqual([]);
    });
  }
});
