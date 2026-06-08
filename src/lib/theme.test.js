import { describe, it, expect } from 'vitest';
import {
  COLORS,
  FONTS,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_BODY,
  FONT_SIZE,
  SPACE,
  BORDER,
  RADIUS,
  SHADOW,
  BUTTON,
  btnSecondary,
  CARD,
  TEXT,
} from './theme';

describe('theme tokens', () => {
  it('exports core colour tokens as hex strings', () => {
    expect(COLORS.paper).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(COLORS.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(COLORS.red).toBe('#D62828');
  });

  it('keeps backward-compat font aliases in sync with FONTS', () => {
    expect(FONT_DISPLAY).toBe(FONTS.display);
    expect(FONT_MONO).toBe(FONTS.mono);
    expect(FONT_BODY).toBe(FONTS.body);
  });

  it('SPACE scale is 4px multiples', () => {
    expect(SPACE[1]).toBe(4);
    expect(SPACE[4]).toBe(16);
    expect(SPACE[16]).toBe(64);
  });

  it('BORDER.standard references ink colour', () => {
    expect(BORDER.standard).toContain(COLORS.ink);
  });

  it('SHADOW.press builds a hard-offset shadow from a lip colour', () => {
    expect(SHADOW.press('#abcdef')).toBe('0 4px 0 #abcdef');
  });

  it('BUTTON variants share base typography and differ by background', () => {
    expect(BUTTON.go.background).toBe(COLORS.green);
    expect(BUTTON.primary.background).toBe(COLORS.ink);
    expect(BUTTON.danger.background).toBe(COLORS.red);
    expect(BUTTON.go.fontFamily).toBe(FONTS.mono);
  });

  it('btnSecondary alias matches BUTTON.secondary', () => {
    expect(btnSecondary).toBe(BUTTON.secondary);
    expect(btnSecondary.flex).toBe(1);
  });

  it('CARD and TEXT presets include expected keys', () => {
    expect(CARD.base).toHaveProperty('background', COLORS.card);
    expect(CARD.dark.color).toBe(COLORS.paper);
    expect(TEXT.label.textTransform).toBe('uppercase');
    expect(TEXT.kicker.color).toBe(COLORS.red);
  });

  it('RADIUS pill is fully round', () => {
    expect(RADIUS.pill).toBe(999);
  });

  it('FONT_SIZE includes hero size for alphabet overlay', () => {
    expect(FONT_SIZE.hero).toBe(120);
  });
});
