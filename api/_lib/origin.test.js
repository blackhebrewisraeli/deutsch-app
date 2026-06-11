import { describe, it, expect } from 'vitest';
import { originAllowed, parseAllowedOrigins } from './origin.js';

describe('parseAllowedOrigins', () => {
  it('splits, trims, and drops empties', () => {
    expect(parseAllowedOrigins(' https://a.com , https://b.com ,')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});

describe('originAllowed', () => {
  it('passes everything when no allow-list is configured', () => {
    expect(originAllowed({ headers: { origin: 'https://evil.com' } }, [])).toBe(true);
  });

  it('passes requests without an Origin header (non-browser clients)', () => {
    expect(originAllowed({ headers: {} }, ['https://a.com'])).toBe(true);
  });

  it('passes a listed origin and rejects an unlisted one', () => {
    const allowed = ['https://a.com'];
    expect(originAllowed({ headers: { origin: 'https://a.com' } }, allowed)).toBe(true);
    expect(originAllowed({ headers: { origin: 'https://evil.com' } }, allowed)).toBe(false);
  });
});
