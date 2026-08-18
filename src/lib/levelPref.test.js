import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LEVELS, readLevel, writeLevel } from './levelPref';

vi.mock('./settingsStamp', () => ({ stampSettings: vi.fn() }));
import { stampSettings } from './settingsStamp';

describe('levelPref', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('lists the three levels in order', () => {
    expect(LEVELS).toEqual(['a1', 'a2', 'b1']);
  });

  it('defaults to a1 when nothing is stored', () => {
    expect(readLevel()).toBe('a1');
  });

  it.each([
    ['beginner', 'a1'],
    ['intermediate', 'b1'],
  ])('maps the legacy value %s to %s', (stored, expected) => {
    localStorage.setItem('deutsch-level', stored);
    expect(readLevel()).toBe(expected);
  });

  it('falls back to a1 for a corrupt value', () => {
    localStorage.setItem('deutsch-level', 'c2');
    expect(readLevel()).toBe('a1');
  });

  it('persists and stamps on write', () => {
    writeLevel('b1');
    expect(localStorage.getItem('deutsch-level')).toBe('b1');
    expect(stampSettings).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown level rather than persisting it', () => {
    writeLevel('a1');
    writeLevel('c2');
    expect(localStorage.getItem('deutsch-level')).toBe('a1');
    expect(stampSettings).toHaveBeenCalledTimes(1);
  });

  it('still stamps settings when storage refuses the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeLevel('b1')).not.toThrow();
    expect(stampSettings).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
