import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  THEME_MODE_KEY,
  THEME_TONE_KEY,
  readThemePreference,
  getThemePreferenceForUI,
  readThemeTone,
  getThemeToneForUI,
  resolveThemeTone,
  getSystemMode,
  resolveThemeMode,
  setThemePreference,
  setThemeTone,
  applyCurrentTheme,
  watchSystemTheme,
} from './themeMode';
import { MODE_COLORS, tokenToCssVar } from './themeTokens';

vi.mock('../packs', () => ({
  activePack: {
    theme: {
      accent: { fill: '#FFCE00', onFill: '#0D0D0F', fg: { light: '#8A6A00', dark: '#FFCE00' } },
      accentAlt: {
        fill: { light: '#C92A2A', dark: '#FF6B6B' },
        onFill: { light: '#FFFFFF', dark: '#0D0D0F' },
      },
      progress: ['ground', 'accentAlt', 'accent'],
      font: {
        display: 'serif',
        body: 'serif',
        mono: 'monospace',
        families: [],
      },
    },
  },
}));

describe('resolveThemeMode', () => {
  it('prefers explicit light/dark over system', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('uses prefers-color-scheme when preference is system or unset', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode(null, 'dark')).toBe('dark');
  });

  it('falls back to dark when neither preference nor system is available', () => {
    expect(resolveThemeMode(null, null)).toBe('dark');
    expect(resolveThemeMode('system', null)).toBe('dark');
  });
});

describe('theme preference persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.cssText = '';
  });

  it('round-trips light/dark/system through localStorage', () => {
    setThemePreference('dark');
    expect(localStorage.getItem(THEME_MODE_KEY)).toBe('dark');
    expect(readThemePreference()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    setThemePreference('light');
    expect(readThemePreference()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    setThemePreference('system');
    expect(readThemePreference()).toBe('system');
  });

  it('treats corrupt stored values as unset rather than throwing', () => {
    localStorage.setItem(THEME_MODE_KEY, 'neon');
    expect(readThemePreference()).toBeNull();
    expect(getThemePreferenceForUI()).toBe('system');
    expect(() => applyCurrentTheme()).not.toThrow();
  });

  it('ignores unknown setThemePreference values without throwing', () => {
    setThemePreference('light');
    expect(() => setThemePreference('sepia')).not.toThrow();
    expect(readThemePreference()).toBe('light');
  });

  it('treats blocked storage reads as unset rather than throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readThemePreference()).toBeNull();
    expect(getThemePreferenceForUI()).toBe('system');
    spy.mockRestore();
  });

  it('still applies a preference when storage refuses the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setThemePreference('light')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('light');
    spy.mockRestore();
  });
});

describe('theme tone persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.cssText = '';
    delete document.documentElement.dataset.tone;
  });

  it('resolveThemeTone defaults unset/corrupt to day', () => {
    expect(resolveThemeTone(null)).toBe('day');
    expect(resolveThemeTone('day')).toBe('day');
    expect(resolveThemeTone('night')).toBe('night');
    expect(resolveThemeTone('sepia')).toBe('day');
  });

  it('round-trips day/night through localStorage and applies palette', () => {
    setThemePreference('light');
    setThemeTone('night');
    expect(localStorage.getItem(THEME_TONE_KEY)).toBe('night');
    expect(readThemeTone()).toBe('night');
    expect(document.documentElement.dataset.tone).toBe('night');
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
      MODE_COLORS.light.night.ground
    );

    setThemeTone('day');
    expect(readThemeTone()).toBe('day');
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
      MODE_COLORS.light.day.ground
    );
  });

  it('applies dark.night when mode is dark and tone is night', () => {
    setThemePreference('dark');
    setThemeTone('night');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.tone).toBe('night');
    expect(document.documentElement.style.getPropertyValue(tokenToCssVar('ground'))).toBe(
      MODE_COLORS.dark.night.ground
    );
  });

  it('treats corrupt tone as day rather than throwing', () => {
    localStorage.setItem(THEME_TONE_KEY, 'twilight');
    expect(readThemeTone()).toBeNull();
    expect(getThemeToneForUI()).toBe('day');
    expect(() => applyCurrentTheme()).not.toThrow();
    expect(document.documentElement.dataset.tone).toBe('day');
  });

  it('ignores unknown setThemeTone values without throwing', () => {
    setThemeTone('night');
    expect(() => setThemeTone('sepia')).not.toThrow();
    expect(readThemeTone()).toBe('night');
  });

  it('treats blocked storage tone reads as day rather than throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readThemeTone()).toBeNull();
    expect(getThemeToneForUI()).toBe('day');
    spy.mockRestore();
  });

  it('still applies a tone when storage refuses the write', () => {
    setThemePreference('dark');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setThemeTone('night')).not.toThrow();
    expect(document.documentElement.dataset.tone).toBe('night');
    spy.mockRestore();
  });
});

describe('system preference watching', () => {
  let listeners;

  beforeEach(() => {
    localStorage.clear();
    listeners = new Set();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query) => ({
        matches: query.includes('dark') ? false : false,
        media: query,
        addEventListener: (_e, fn) => listeners.add(fn),
        removeEventListener: (_e, fn) => listeners.delete(fn),
        addListener: (fn) => listeners.add(fn),
        removeListener: (fn) => listeners.delete(fn),
      }))
    );
    // Force light system mode for the stub above
    window.matchMedia = vi.fn(() => ({
      matches: false, // light
      media: '(prefers-color-scheme: dark)',
      addEventListener: (_e, fn) => listeners.add(fn),
      removeEventListener: (_e, fn) => listeners.delete(fn),
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getSystemMode reads matchMedia', () => {
    expect(getSystemMode()).toBe('light');
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(getSystemMode()).toBe('dark');
  });

  it('re-applies when OS scheme changes while preference is system', () => {
    setThemePreference('system');
    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange);

    // Flip OS to dark
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: (_e, fn) => listeners.add(fn),
      removeEventListener: (_e, fn) => listeners.delete(fn),
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
    }));
    for (const fn of listeners) fn({ matches: true });

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(onChange).toHaveBeenCalledWith('dark');
    stop();
  });

  it('does not re-apply OS changes when preference is explicit', () => {
    setThemePreference('light');
    watchSystemTheme();
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: (_e, fn) => listeners.add(fn),
      removeEventListener: (_e, fn) => listeners.delete(fn),
    }));
    for (const fn of [...listeners]) fn({ matches: true });
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
