import { describe, it, expect, beforeEach } from 'vitest';
import { injectFonts, familySlug } from './injectFonts';

const FAMILIES = [{ name: 'Fraunces' }, { name: 'JetBrains Mono' }];

describe('familySlug', () => {
  it('lowercases and hyphenates a family name', () => {
    expect(familySlug('Fraunces')).toBe('fraunces');
    expect(familySlug('JetBrains Mono')).toBe('jetbrains-mono');
  });

  it('collapses punctuation rather than emitting it into a path', () => {
    expect(familySlug('Noto Sans JP')).toBe('noto-sans-jp');
    expect(familySlug('  Spaced  Out  ')).toBe('spaced-out');
  });
});

describe('injectFonts', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('links one local stylesheet per family', () => {
    injectFonts(FAMILIES);
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    expect(links.map((l) => new URL(l.href).pathname)).toEqual([
      '/fonts/fraunces/face.css',
      '/fonts/jetbrains-mono/face.css',
    ]);
  });

  it('reaches no third-party host', () => {
    // The whole point of the mission: an offline-capable PWA cannot depend on
    // a CDN for its typography, and the browser HTTP cache that used to make
    // that appear to work is not one the service worker can refill.
    injectFonts(FAMILIES);
    expect(document.head.innerHTML).not.toContain('googleapis.com');
    expect(document.head.innerHTML).not.toContain('gstatic.com');
    expect(document.querySelectorAll('link[rel="preconnect"]')).toHaveLength(0);
  });

  it('is idempotent', () => {
    injectFonts(FAMILIES);
    injectFonts(FAMILIES);
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(2);
  });

  it('does nothing when given no families', () => {
    injectFonts([]);
    injectFonts(undefined);
    expect(document.head.children).toHaveLength(0);
  });

  it('skips a malformed entry instead of writing /fonts//face.css', () => {
    injectFonts([{ name: 'Fraunces' }, {}, { name: '' }]);
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    expect(links).toHaveLength(1);
    expect(new URL(links[0].href).pathname).toBe('/fonts/fraunces/face.css');
  });
});
