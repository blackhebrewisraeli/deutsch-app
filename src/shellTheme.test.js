import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODE_COLORS } from './lib/themeTokens';

// index.html paints a pre-JS shell so the app is not a blank screen while the
// entry chunk downloads. CSS cannot import the token module, so those colours
// are copied into the HTML — and a copy is exactly the thing that rots. This
// fails the build the moment the two disagree.
const html = readFileSync('index.html', 'utf8');

/** The shell writes its palette through a JS map keyed `mode-tone`. */
function shellPalette(key) {
  const m = html.match(new RegExp(`'${key}':\\s*\\[([^\\]]+)\\]`));
  if (!m) throw new Error(`index.html has no shell palette for "${key}"`);
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '').toLowerCase());
}

describe('pre-JS shell colours match the theme tokens', () => {
  for (const mode of ['light', 'dark']) {
    for (const tone of ['day', 'night']) {
      it(`${mode}.${tone} ground and fg match themeTokens`, () => {
        const [bg, fg] = shellPalette(`${mode}-${tone}`);
        const palette = MODE_COLORS[mode][tone];
        expect(bg).toBe(palette.ground.toLowerCase());
        expect(fg).toBe(palette.fg.toLowerCase());
      });

      it(`${mode}.${tone} wordmark dot matches the palette error colour`, () => {
        const [, , dot] = shellPalette(`${mode}-${tone}`);
        // App.jsx renders the dot in "Deutsch." as COLORS.red — `error`.
        expect(dot).toBe(MODE_COLORS[mode][tone].error.toLowerCase());
      });
    }
  }

  it('falls back to light.day and dark.day in the static CSS', () => {
    // The CSS custom properties are what render if the inline script throws
    // (private mode). They must still be real theme grounds.
    const lightBlock = html.match(/:root\s*\{([^}]+)\}/)[1];
    const darkBlock = html.match(/prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root\s*\{([^}]+)\}/)[1];
    expect(lightBlock).toContain(MODE_COLORS.light.day.ground.toLowerCase());
    expect(darkBlock).toContain(MODE_COLORS.dark.day.ground.toLowerCase());
  });

  it('keeps the shell out of the accessibility tree and un-tappable', () => {
    expect(html).toMatch(/id="shell"[^>]*aria-hidden="true"/);
    expect(html).toMatch(/#shell\s*\{[^}]*pointer-events:\s*none/);
  });
});
