import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LEVELS,
  LEVEL_CHANGE_EVENT,
  readLevel,
  writeLevel,
  hasStoredLevel,
  getUserLevel,
  setUserLevel,
} from './levelPref';

vi.mock('./settingsStamp', () => ({ stampLevel: vi.fn() }));
import { stampLevel } from './settingsStamp';

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
    expect(stampLevel).toHaveBeenCalledTimes(1);
  });

  it('ignores an unknown level rather than persisting it', () => {
    writeLevel('a1');
    writeLevel('c2');
    expect(localStorage.getItem('deutsch-level')).toBe('a1');
    expect(stampLevel).toHaveBeenCalledTimes(1);
  });

  it('still stamps the level when storage refuses the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeLevel('b1')).not.toThrow();
    expect(stampLevel).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it.each([
    ['a1', true],
    ['a2', true],
    ['b1', true],
    ['beginner', true],
    ['intermediate', true],
    ['c2', false],
    ['', false],
    ['constructor', false],
  ])('hasStoredLevel(%s) is %s', (stored, expected) => {
    localStorage.setItem('deutsch-level', stored);
    expect(hasStoredLevel()).toBe(expected);
  });

  it('reports no stored level when nothing is stored', () => {
    expect(hasStoredLevel()).toBe(false);
  });

  it('reports no stored level when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(hasStoredLevel()).toBe(false);
    spy.mockRestore();
  });
});

describe('getUserLevel / setUserLevel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults to a1 when nothing is stored', () => {
    expect(getUserLevel()).toBe('a1');
  });

  it('round-trips every level', () => {
    for (const level of LEVELS) {
      expect(setUserLevel(level)).toBe(true);
      expect(getUserLevel()).toBe(level);
    }
  });

  // Levels are lowercase CEFR codes. Accepting 'A1' would write a value that
  // readLevel then resolves as corrupt, silently resetting the user to a1 —
  // so it is rejected at the door rather than coerced.
  it('rejects uppercase rather than coercing it', () => {
    setUserLevel('b1');
    expect(setUserLevel('A1')).toBe(false);
    expect(getUserLevel()).toBe('b1');
  });

  it.each([['c1'], [''], ['beginner-ish'], [null], [undefined], [42], [{}]])(
    'rejects invalid input %p without disturbing the stored level',
    (bad) => {
      setUserLevel('a2');
      expect(setUserLevel(bad)).toBe(false);
      expect(getUserLevel()).toBe('a2');
    }
  );

  it('dispatches a change event carrying the new level', () => {
    const seen = [];
    const onChange = (e) => seen.push(e.detail.level);
    window.addEventListener(LEVEL_CHANGE_EVENT, onChange);
    setUserLevel('b1');
    window.removeEventListener(LEVEL_CHANGE_EVENT, onChange);
    expect(seen).toEqual(['b1']);
  });

  // The notifier fires from writeLevel, not only setUserLevel, so the existing
  // callers (picker, splash, sync) emit it too. A notifier only half the
  // writers fire is worse than none — a listener would look correct and miss.
  it('dispatches for writeLevel callers too', () => {
    const onChange = vi.fn();
    window.addEventListener(LEVEL_CHANGE_EVENT, onChange);
    writeLevel('a2');
    window.removeEventListener(LEVEL_CHANGE_EVENT, onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch for a rejected value', () => {
    const onChange = vi.fn();
    window.addEventListener(LEVEL_CHANGE_EVENT, onChange);
    setUserLevel('nope');
    window.removeEventListener(LEVEL_CHANGE_EVENT, onChange);
    expect(onChange).not.toHaveBeenCalled();
  });

  // Private mode refuses the write, but the session's in-memory state did move,
  // so the UI must still be told or the picker visibly does nothing.
  it('still announces when storage refuses the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const onChange = vi.fn();
    window.addEventListener(LEVEL_CHANGE_EVENT, onChange);
    expect(() => setUserLevel('b1')).not.toThrow();
    window.removeEventListener(LEVEL_CHANGE_EVENT, onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
