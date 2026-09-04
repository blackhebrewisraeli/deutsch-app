import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODE_COLORS } from './lib/themeTokens';

const html = readFileSync('index.html', 'utf8');
const vite = readFileSync('vite.config.js', 'utf8');

describe('PWA shell metadata', () => {
  it('opts the viewport into cover so standalone iOS paints edge-to-edge', () => {
    expect(html).toMatch(/name="viewport"[^>]*viewport-fit=cover/);
  });

  it('declares standalone install chrome', () => {
    expect(html).toMatch(/name="apple-mobile-web-app-capable"[^>]*content="yes"/);
    expect(html).toMatch(/name="mobile-web-app-capable"[^>]*content="yes"/);
    expect(html).toMatch(
      /name="apple-mobile-web-app-status-bar-style"[^>]*content="black-translucent"/
    );
  });

  it('points apple-touch-icon at the committed 180px asset', () => {
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"/);
  });

  it('keeps theme-color on the light-mode ink token — the masthead is charcoal', () => {
    expect(html).toMatch(
      new RegExp(`name="theme-color"[^>]*content="${MODE_COLORS.light.fg}"`, 'i')
    );
  });
});

describe('vite-plugin-pwa manifest', () => {
  it('installs as a standalone portrait app', () => {
    expect(vite).toMatch(/display:\s*['"]standalone['"]/);
    expect(vite).toMatch(/orientation:\s*['"]portrait-primary['"]/);
  });

  it('maps splash and chrome colours to the light theme tokens', () => {
    expect(vite).toContain('MODE_COLORS');
    expect(vite).toMatch(/background_color:/);
    expect(vite).toMatch(/theme_color:/);
  });

  it('precache includes the app shell and static assets, with an HTML fallback', () => {
    expect(vite).toMatch(/globPatterns:\s*\[[^\]]*html/);
    expect(vite).toMatch(/globPatterns:\s*\[[^\]]*js/);
    expect(vite).toMatch(/globPatterns:\s*\[[^\]]*css/);
    expect(vite).toMatch(/navigateFallback:\s*['"]\/index\.html['"]/);
  });
});
