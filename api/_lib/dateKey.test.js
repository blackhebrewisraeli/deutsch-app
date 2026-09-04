import { describe, it, expect } from 'vitest';
import { isValidDateKey } from './dateKey.js';

describe('isValidDateKey', () => {
  it('accepts a well-formed, calendar-real date', () => {
    expect(isValidDateKey('2026-09-04')).toBe(true);
  });

  it('accepts a real leap day', () => {
    expect(isValidDateKey('2024-02-29')).toBe(true);
  });

  it('rejects a fake leap day', () => {
    expect(isValidDateKey('2026-02-29')).toBe(false);
  });

  it('rejects a well-formed but nonexistent day', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false);
  });

  it('rejects a well-formed but nonexistent month', () => {
    expect(isValidDateKey('2026-13-45')).toBe(false);
  });

  it('rejects a shape without zero-padding', () => {
    expect(isValidDateKey('2026-9-4')).toBe(false);
  });

  it('rejects a shape in the wrong order', () => {
    expect(isValidDateKey('04-09-2026')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidDateKey('')).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidDateKey(null)).toBe(false);
  });

  it('rejects a number', () => {
    expect(isValidDateKey(20260904)).toBe(false);
  });

  it('rejects a full timestamp', () => {
    expect(isValidDateKey('2026-09-04T00:00:00Z')).toBe(false);
  });
});
