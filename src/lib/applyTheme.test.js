import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from './applyTheme';
import { MODE_COLORS, DEFAULT_ACCENTS, tokenToCssVar } from './themeTokens';

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = '';
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.tone;
  });

  it('writes light.day structural tokens onto :root by default', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.tone).toBe('day');
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
      MODE_COLORS.light.day.ground
    );
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('fg'))).toBe(
      MODE_COLORS.light.day.fg
    );
    expect(document.documentElement.style.getPropertyValue('--c-accent')).toBe(
      DEFAULT_ACCENTS.light.accent
    );
  });

  it('writes Nocturne dark.day tokens onto :root', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.tone).toBe('day');
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
      MODE_COLORS.dark.day.ground
    );
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('error'))).toBe(
      MODE_COLORS.dark.day.error
    );
  });

  it('writes each of the four mode×tone palettes', () => {
    const cases = [
      ['light', 'day'],
      ['light', 'night'],
      ['dark', 'day'],
      ['dark', 'night'],
    ];
    for (const [mode, tone] of cases) {
      applyTheme(mode, undefined, tone);
      expect(document.documentElement.dataset.theme).toBe(mode);
      expect(document.documentElement.dataset.tone).toBe(tone);
      expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
        MODE_COLORS[mode][tone].ground
      );
    }
  });

  it('overlays pack accents when provided', () => {
    applyTheme(
      'light',
      {
        accent: { fill: '#FFCE00', onFill: '#0D0D0F', fg: { light: '#8A6A00', dark: '#FFCE00' } },
        accentAlt: {
          fill: { light: '#C92A2A', dark: '#FF6B6B' },
          onFill: { light: '#FFFFFF', dark: '#0D0D0F' },
        },
      },
      'night'
    );
    expect(document.documentElement.style.getPropertyValue('--c-accent')).toBe('#FFCE00');
    expect(document.documentElement.style.getPropertyValue('--c-accent-fg')).toBe('#8A6A00');
    expect(document.documentElement.style.getPropertyValue('--c-accent-alt')).toBe('#C92A2A');
    expect(document.documentElement.dataset.tone).toBe('night');
  });

  it('writes derived elevation and accent ramp steps', () => {
    applyTheme('light');
    const root = document.documentElement.style;
    expect(root.getPropertyValue('--c-surface-1')).toMatch(/^#/);
    expect(root.getPropertyValue('--c-surface-2')).toMatch(/^#/);
    expect(root.getPropertyValue('--c-surface-3')).toMatch(/^#/);
    expect(root.getPropertyValue('--c-accent-soft')).toMatch(/^#/);
    expect(root.getPropertyValue('--c-accent-deep')).toMatch(/^#/);
    expect(root.getPropertyValue('--c-success-soft')).toBe(MODE_COLORS.light.day['success-fill']);
    expect(root.getPropertyValue('--c-error-soft')).toBe(MODE_COLORS.light.day['error-fill']);
    // Legacy aliases still resolve
    expect(root.getPropertyValue('--c-surface')).toBe(MODE_COLORS.light.day.surface);
    expect(root.getPropertyValue('--c-surface-alt')).toBe(MODE_COLORS.light.day['surface-alt']);
  });
});
