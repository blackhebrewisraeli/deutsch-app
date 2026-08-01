import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from './applyTheme';
import { MODE_COLORS, DEFAULT_ACCENTS, tokenToCssVar } from './themeTokens';

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
    delete document.documentElement.dataset.theme;
  });

  it('writes structural light tokens onto :root', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
      MODE_COLORS.light.ground
    );
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('fg'))).toBe(
      MODE_COLORS.light.fg
    );
    expect(document.documentElement.style.getPropertyValue('--c-accent')).toBe(
      DEFAULT_ACCENTS.light.accent
    );
  });

  it('writes Nocturne dark tokens onto :root', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
      MODE_COLORS.dark.ground
    );
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('error'))).toBe(
      MODE_COLORS.dark.error
    );
  });

  it('overlays pack accents when provided', () => {
    applyTheme('light', {
      accent: { fill: '#FFCE00', onFill: '#0D0D0F', fg: { light: '#8A6A00', dark: '#FFCE00' } },
      accentAlt: {
        fill: { light: '#C92A2A', dark: '#FF6B6B' },
        onFill: { light: '#FFFFFF', dark: '#0D0D0F' },
      },
    });
    expect(document.documentElement.style.getPropertyValue('--c-accent')).toBe('#FFCE00');
    expect(document.documentElement.style.getPropertyValue('--c-accent-fg')).toBe('#8A6A00');
    expect(document.documentElement.style.getPropertyValue('--c-accent-alt')).toBe('#C92A2A');
  });
});
