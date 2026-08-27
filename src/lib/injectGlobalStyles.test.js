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

  // Before this rule existed the app had three hand-rolled `:focus-visible`
  // recipes (WelcomeGate, TrialWall, LeaderboardSection) with three different
  // spellings, and the other 78 raw <button> elements had no ring at all.
  // Keying off [data-ui] means a primitive opts in by existing.
  it('gives every [data-ui] element a focus-visible ring', () => {
    injectGlobalStyles();
    expect(sheet()).toMatch(/\[data-ui\]:focus-visible\s*\{[^}]*outline:/);
  });

  it('uses the theme ink for the ring, so it flips with the mode', () => {
    injectGlobalStyles();
    // var(--c-fg), not a literal — the ring must not be a light-mode colour.
    expect(sheet()).toMatch(/\[data-ui\]:focus-visible\s*\{[^}]*var\(--c-fg\)/);
  });

  it('offers an inset offset for full-bleed rows', () => {
    injectGlobalStyles();
    // League rows are flush to their container, so an outset ring is clipped
    // by the parent edge and overlaps the neighbouring row.
    expect(sheet()).toMatch(/\[data-focus-inset\]:focus-visible\s*\{[^}]*outline-offset:\s*-3px/);
  });

  it('gates button hover behind a fine pointer', () => {
    injectGlobalStyles();
    // Without the gate a touch device latches the hover style on tap and keeps
    // it until the next tap elsewhere. This app is phone-first, so that is the
    // common case, not the edge case.
    expect(sheet()).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
  });

  it('does not apply hover to a disabled or busy button', () => {
    injectGlobalStyles();
    const hoverRule = sheet().match(/\[data-ui="button"\][^{]*:hover/)?.[0] ?? '';
    expect(hoverRule).toContain(':not([disabled])');
    expect(hoverRule).toContain(':not([aria-busy="true"])');
  });
});
