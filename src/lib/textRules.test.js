import { describe, it, expect } from 'vitest';
import { normalizeText, CHOICE, ANSWER } from './textRules';

const GERMAN = {
  trim: true,
  caseFold: true,
  stripCombiningMarks: false,
  replacements: [
    ['ß', 'ss'],
    ['ä', 'ae'],
    ['ö', 'oe'],
    ['ü', 'ue'],
  ],
};

const NONE = { trim: false, caseFold: false, stripCombiningMarks: false, replacements: [] };

describe('normalizeText', () => {
  it('applies no rule when every flag is off', () => {
    expect(normalizeText('  Groß  ', NONE)).toBe('  Groß  ');
  });

  it('trims only when trim is on', () => {
    expect(normalizeText('  hi  ', { ...NONE, trim: true })).toBe('hi');
    expect(normalizeText('  hi  ', NONE)).toBe('  hi  ');
  });

  it('lowercases only when caseFold is on', () => {
    expect(normalizeText('ÄRGER', { ...NONE, caseFold: true })).toBe('ärger');
    expect(normalizeText('ÄRGER', NONE)).toBe('ÄRGER');
  });

  // caseFold is toLowerCase(), NOT Unicode full case folding — full folding
  // maps ß→ss on its own, which would pre-empt a pack's own declaration.
  it('leaves ß alone when only caseFold is on', () => {
    expect(normalizeText('GROSS', { ...NONE, caseFold: true })).toBe('gross');
    expect(normalizeText('Groß', { ...NONE, caseFold: true })).toBe('groß');
  });

  it('strips combining marks only when that flag is on', () => {
    expect(normalizeText('schön', { ...NONE, stripCombiningMarks: true })).toBe('schon');
    expect(normalizeText('schön', NONE)).toBe('schön');
  });

  it('applies replacements globally', () => {
    expect(normalizeText('ääa', { ...NONE, replacements: [['ä', 'ae']] })).toBe('aeaea');
  });

  // The order is contractual: caseFold must precede replacements, so a pack
  // declares only lowercase pairs and uppercase input still folds.
  it('case-folds before replacing, so ÄRGER reaches aerger', () => {
    expect(normalizeText('ÄRGER', GERMAN)).toBe('aerger');
  });

  it('applies replacements in declared order', () => {
    // ß→ss runs first, then ü→ue: Tschüß → tschüss → tschuess
    expect(normalizeText('Tschüß', GERMAN)).toBe('tschuess');
  });

  // Called on user input inside a render path — must never throw.
  it('returns an empty string for non-string input', () => {
    expect(normalizeText(undefined, GERMAN)).toBe('');
    expect(normalizeText(null, GERMAN)).toBe('');
    expect(normalizeText(42, GERMAN)).toBe('');
  });
});

describe('engine rule sets', () => {
  it('CHOICE trims and folds case — tapped tiles vary only in capitalisation', () => {
    expect(normalizeText('  Die Katze  ', CHOICE)).toBe('die katze');
    expect(normalizeText('Bin', CHOICE)).toBe(normalizeText('bin', CHOICE));
  });

  // The pack's substitutions never reach a tile comparison, so no pack can
  // make a word and a distractor collide there.
  it('CHOICE carries no replacements, so Fuß and Fuss stay distinct', () => {
    expect(normalizeText('Fuß', CHOICE)).not.toBe(normalizeText('Fuss', CHOICE));
  });

  it('ANSWER trims and case-folds, reproducing the old pack normalize exactly', () => {
    const old = (s) => s.trim().toLowerCase();
    for (const sample of ['  Apple ', 'THE CAT', 'groß']) {
      expect(normalizeText(sample, ANSWER)).toBe(old(sample));
    }
  });

  it('neither engine set folds diacritics — that is a pack concern', () => {
    expect(normalizeText('schön', ANSWER)).toBe('schön');
    expect(normalizeText('groß', ANSWER)).toBe('groß');
    expect(normalizeText('schön', CHOICE)).toBe('schön');
  });
});
