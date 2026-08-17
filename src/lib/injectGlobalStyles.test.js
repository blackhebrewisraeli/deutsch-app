import { describe, it, expect, beforeEach } from 'vitest';
import { injectGlobalStyles } from './injectGlobalStyles';

const sheet = () => document.getElementById('deutsch-global-styles')?.textContent ?? '';

beforeEach(() => {
  document.getElementById('deutsch-global-styles')?.remove();
});

describe('injectGlobalStyles', () => {
  it('injects once and is idempotent', () => {
    injectGlobalStyles();
    injectGlobalStyles();
    expect(document.querySelectorAll('#deutsch-global-styles')).toHaveLength(1);
  });

  // The bug this guards was invisible to every automated check available here:
  // jsdom computes no layout, and Chromium mobile emulation reports the full
  // viewport. On a real iPhone, 100vh excludes the URL bar, so a 100vh entry
  // screen is taller than the visible area and its bottom sits behind Safari's
  // chrome — the splash's gold stripe was cut off. Asserting the declarations
  // is the strongest check this environment supports.
  it('sizes entry screens by the dynamic viewport', () => {
    injectGlobalStyles();
    expect(sheet()).toMatch(/\.entry-screen\s*\{[^}]*min-height:\s*100dvh/);
  });

  it('keeps a 100vh fallback ahead of the dvh declaration', () => {
    injectGlobalStyles();
    // Order is the fallback mechanism: an engine without dvh keeps the first
    // declaration, one with dvh overrides it. Reversing them silently breaks
    // the fallback while still containing both strings.
    const rule = sheet().match(/\.entry-screen\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule.indexOf('100vh')).toBeGreaterThanOrEqual(0);
    expect(rule.indexOf('100vh')).toBeLessThan(rule.indexOf('100dvh'));
  });

  it('pads the last stripe clear of the home indicator', () => {
    injectGlobalStyles();
    expect(sheet()).toMatch(/\.entry-screen-foot\s*\{[^}]*safe-area-inset-bottom/);
  });
});
