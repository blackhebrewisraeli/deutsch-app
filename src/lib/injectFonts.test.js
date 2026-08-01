import { describe, it, expect, beforeEach } from 'vitest';
import { buildGoogleFontsUrl, injectFonts } from './injectFonts';

const FAMILIES = [
  {
    name: 'Fraunces',
    weights: [300, 400, 700, 900],
    axes: 'opsz,wght@9..144,300;9..144,400;9..144,700;9..144,900',
  },
  { name: 'JetBrains Mono', weights: [400, 500, 700], axes: 'wght@400;500;700' },
];

describe('buildGoogleFontsUrl', () => {
  it('builds a css2 URL from pack font.families', () => {
    const url = buildGoogleFontsUrl(FAMILIES);
    expect(url).toContain('https://fonts.googleapis.com/css2?');
    expect(url).toContain('family=Fraunces:opsz,wght@');
    expect(url).toContain('family=JetBrains+Mono:wght@400;500;700');
    expect(url).toContain('display=swap');
  });
});

describe('injectFonts', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('injects preconnect + stylesheet links once', () => {
    injectFonts(FAMILIES);
    injectFonts(FAMILIES); // idempotent
    expect(document.querySelectorAll('link[rel="preconnect"]')).toHaveLength(2);
    expect(document.getElementById('deutsch-fonts')?.rel).toBe('stylesheet');
    expect(document.getElementById('deutsch-fonts')?.href).toContain('fonts.googleapis.com');
  });
});
