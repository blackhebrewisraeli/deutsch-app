import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TABS,
  LEVELS,
  VERDICTS,
  todayKey,
  emptyDayAggregate,
  applyEvent,
  getHeatmapData,
  getPerTabBreakdown,
  getAccuracyByLevel,
  getTodaySnapshot,
  recordEvent,
  itemKey,
  applyItemEvent,
  getReviewItems,
  recordItem,
} from './stats';
import { loadState } from './storage';

const STORAGE_KEY = 'deutsch-app-state-v1';

// ─── Constants ────────────────────────────────────────────────

describe('constants', () => {
  it('TABS includes the 4 app tabs', () => {
    expect(TABS).toEqual(['chat', 'alphabet', 'vocab', 'translate']);
  });
  it('LEVELS includes the 3 CEFR levels', () => {
    expect(LEVELS).toEqual(['a1', 'a2', 'b1']);
  });
  it('VERDICTS is the three-way classification', () => {
    expect(VERDICTS).toEqual(['correct', 'almost', 'wrong']);
  });
});

// ─── todayKey ─────────────────────────────────────────────────

describe('todayKey', () => {
  it('returns YYYY-MM-DD for a given Date in local time', () => {
    expect(todayKey(new Date(2026, 5, 6))).toBe('2026-06-06');
    expect(todayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(todayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('zero-pads months and days under 10', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayKey(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('defaults to today when called with no argument', () => {
    const key = todayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── emptyDayAggregate ────────────────────────────────────────

describe('emptyDayAggregate', () => {
  it('returns total: 0', () => {
    expect(emptyDayAggregate().total).toBe(0);
  });

  it('returns zero counts for every tab', () => {
    const day = emptyDayAggregate();
    for (const tab of TABS) {
      expect(day.byTab[tab]).toBe(0);
    }
  });

  it('returns zero verdict counts for every level', () => {
    const day = emptyDayAggregate();
    for (const level of LEVELS) {
      for (const verdict of VERDICTS) {
        expect(day.byLevel[level][verdict]).toBe(0);
      }
    }
  });

  it('returns a fresh object each call (no aliasing)', () => {
    const a = emptyDayAggregate();
    const b = emptyDayAggregate();
    a.total = 99;
    expect(b.total).toBe(0);
  });
});

// ─── applyEvent ───────────────────────────────────────────────

describe('applyEvent', () => {
  it('creates the day aggregate when absent', () => {
    const next = applyEvent({}, '2026-06-06', 'chat', 'a1', 'correct');
    expect(next['2026-06-06']).toBeDefined();
    expect(next['2026-06-06'].total).toBe(1);
  });

  it('increments total, byTab, and byLevel together', () => {
    const next = applyEvent({}, '2026-06-06', 'vocab', 'b1', 'almost');
    expect(next['2026-06-06'].total).toBe(1);
    expect(next['2026-06-06'].byTab.vocab).toBe(1);
    expect(next['2026-06-06'].byLevel.b1.almost).toBe(1);
  });

  it('accumulates across multiple events on the same day', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'wrong');
    daily = applyEvent(daily, '2026-06-06', 'vocab', 'a1', 'correct');
    expect(daily['2026-06-06'].total).toBe(3);
    expect(daily['2026-06-06'].byTab.chat).toBe(2);
    expect(daily['2026-06-06'].byTab.vocab).toBe(1);
    expect(daily['2026-06-06'].byLevel.a1.correct).toBe(2);
    expect(daily['2026-06-06'].byLevel.a1.wrong).toBe(1);
  });

  it('keeps days isolated from each other', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-05', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
    expect(daily['2026-06-05'].total).toBe(1);
    expect(daily['2026-06-06'].total).toBe(1);
  });

  it('does not mutate the input daily object', () => {
    const before = {};
    applyEvent(before, '2026-06-06', 'chat', 'a1', 'correct');
    expect(before).toEqual({});
  });

  it('throws on an invalid tab', () => {
    expect(() => applyEvent({}, '2026-06-06', 'nope', 'a1', 'correct')).toThrow(/tab/);
  });

  it('throws on an invalid level', () => {
    expect(() => applyEvent({}, '2026-06-06', 'chat', 'c1', 'correct')).toThrow(/level/);
  });

  it('throws on an invalid verdict', () => {
    expect(() => applyEvent({}, '2026-06-06', 'chat', 'a1', 'okay')).toThrow(/verdict/);
  });
});

// ─── getHeatmapData ───────────────────────────────────────────

describe('getHeatmapData', () => {
  it('returns the requested number of days ending at the end date (inclusive)', () => {
    const data = getHeatmapData({}, new Date(2026, 5, 6), 7);
    expect(data).toHaveLength(7);
    expect(data[0].date).toBe('2026-05-31');
    expect(data[6].date).toBe('2026-06-06');
  });

  it('reports total: 0 for days without activity', () => {
    const data = getHeatmapData({}, new Date(2026, 5, 6), 3);
    for (const day of data) {
      expect(day.total).toBe(0);
      expect(day.intensity).toBe(0);
    }
  });

  it('reports the correct total for days with events', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-06', 'vocab', 'a1', 'wrong');
    const data = getHeatmapData(daily, new Date(2026, 5, 6), 1);
    expect(data[0].total).toBe(2);
  });

  it('buckets intensity into 5 levels (0..4) based on total', () => {
    const days = [0, 1, 3, 5, 12, 25];
    const expected = [0, 1, 1, 2, 3, 4];
    for (let i = 0; i < days.length; i++) {
      let daily = {};
      for (let n = 0; n < days[i]; n++) {
        daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
      }
      const data = getHeatmapData(daily, new Date(2026, 5, 6), 1);
      expect(data[0].intensity).toBe(expected[i]);
    }
  });
});

// ─── getPerTabBreakdown ───────────────────────────────────────

describe('getPerTabBreakdown', () => {
  it('sums all events across all days when no range given', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-04', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-05', 'chat', 'a1', 'wrong');
    daily = applyEvent(daily, '2026-06-06', 'vocab', 'a1', 'correct');
    expect(getPerTabBreakdown(daily)).toEqual({
      chat: 2,
      alphabet: 0,
      vocab: 1,
      translate: 0,
    });
  });

  it('respects the fromKey/toKey range (inclusive)', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-01', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-03', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
    expect(getPerTabBreakdown(daily, '2026-06-02', '2026-06-05').chat).toBe(1);
  });

  it('returns all zeros for empty daily', () => {
    expect(getPerTabBreakdown({})).toEqual({
      chat: 0,
      alphabet: 0,
      vocab: 0,
      translate: 0,
    });
  });
});

// ─── getAccuracyByLevel ───────────────────────────────────────

describe('getAccuracyByLevel', () => {
  it('aggregates verdict counts per level', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'wrong');
    daily = applyEvent(daily, '2026-06-06', 'vocab', 'b1', 'almost');
    expect(getAccuracyByLevel(daily)).toEqual({
      a1: { correct: 1, almost: 0, wrong: 1 },
      a2: { correct: 0, almost: 0, wrong: 0 },
      b1: { correct: 0, almost: 1, wrong: 0 },
    });
  });

  it('returns zeros for every level when daily is empty', () => {
    const result = getAccuracyByLevel({});
    for (const level of LEVELS) {
      for (const v of VERDICTS) {
        expect(result[level][v]).toBe(0);
      }
    }
  });

  it('respects fromKey/toKey range', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-01', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
    const result = getAccuracyByLevel(daily, '2026-06-05', '2026-06-06');
    expect(result.a1.correct).toBe(1);
  });
});

// ─── getTodaySnapshot ─────────────────────────────────────────

describe('getTodaySnapshot', () => {
  it('returns exercises = total and accuracy = sum of verdicts across all levels for today', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-06-06', 'chat', 'a1', 'correct');
    daily = applyEvent(daily, '2026-06-06', 'vocab', 'b1', 'almost');
    daily = applyEvent(daily, '2026-06-06', 'alphabet', 'a1', 'wrong');
    const snap = getTodaySnapshot(daily, { streak: 5 }, '2026-06-06');
    expect(snap.exercises).toBe(3);
    expect(snap.accuracy).toEqual({ correct: 1, almost: 1, wrong: 1 });
    expect(snap.streak).toBe(5);
  });

  it('returns zeros for accuracy and exercises when today has no data', () => {
    const snap = getTodaySnapshot({}, { streak: 0 }, '2026-06-06');
    expect(snap.exercises).toBe(0);
    expect(snap.accuracy).toEqual({ correct: 0, almost: 0, wrong: 0 });
  });
});

// ─── recordEvent (imperative wrapper) ─────────────────────────

describe('recordEvent', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a single event to localStorage under today's key", () => {
    recordEvent('chat', 'a1', 'correct');
    const state = loadState();
    const key = todayKey();
    expect(state.daily[key].total).toBe(1);
    expect(state.daily[key].byTab.chat).toBe(1);
    expect(state.daily[key].byLevel.a1.correct).toBe(1);
  });

  it('preserves existing stats and learnedWords on the saved state', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stats: { streak: 7, learnedCount: 12, lastVisit: 'Sat Jun 06 2026' },
        learnedWords: { Hallo: true },
      })
    );
    recordEvent('vocab', 'a1', 'almost');
    const state = loadState();
    expect(state.stats.streak).toBe(7);
    expect(state.learnedWords.Hallo).toBe(true);
    expect(state.daily[todayKey()].byLevel.a1.almost).toBe(1);
  });

  it('accumulates across multiple calls', () => {
    recordEvent('chat', 'a1', 'correct');
    recordEvent('chat', 'a1', 'wrong');
    recordEvent('vocab', 'b1', 'almost');
    const state = loadState();
    const key = todayKey();
    expect(state.daily[key].total).toBe(3);
    expect(state.daily[key].byTab.chat).toBe(2);
    expect(state.daily[key].byTab.vocab).toBe(1);
  });

  it('silently no-ops when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordEvent('chat', 'a1', 'correct')).not.toThrow();
  });
});

// ─── itemKey ──────────────────────────────────────────────────

describe('itemKey', () => {
  it('joins tab, context, label with colons', () => {
    expect(itemKey('vocab', 'greetings', 'Hallo')).toBe('vocab:greetings:Hallo');
    expect(itemKey('translate', 'a1', 'I drink water.')).toBe('translate:a1:I drink water.');
  });

  it('allows an empty context (e.g. alphabet has no deck/level context)', () => {
    expect(itemKey('alphabet', '', 'O')).toBe('alphabet::O');
  });
});

// ─── applyItemEvent ───────────────────────────────────────────

describe('applyItemEvent', () => {
  it('creates a new item when absent', () => {
    const next = applyItemEvent({}, 'vocab', 'greetings', 'Hallo', 'Hello', 'wrong', 1000);
    const k = 'vocab:greetings:Hallo';
    expect(next[k]).toBeDefined();
    expect(next[k]).toMatchObject({
      tab: 'vocab',
      context: 'greetings',
      label: 'Hallo',
      detail: 'Hello',
      lastVerdict: 'wrong',
      lastTs: 1000,
      attempts: 1,
      wrongCount: 1,
    });
  });

  it('updates an existing item — increments attempts and refreshes timestamp', () => {
    let items = {};
    items = applyItemEvent(items, 'vocab', 'food', 'das Brot', 'bread', 'wrong', 1000);
    items = applyItemEvent(items, 'vocab', 'food', 'das Brot', 'bread', 'correct', 2000);
    const k = 'vocab:food:das Brot';
    expect(items[k].attempts).toBe(2);
    expect(items[k].lastVerdict).toBe('correct');
    expect(items[k].lastTs).toBe(2000);
    expect(items[k].wrongCount).toBe(1);
  });

  it('counts both wrong AND almost toward wrongCount (non-correct attempts)', () => {
    let items = {};
    items = applyItemEvent(items, 'vocab', 'food', 'der Käse', 'cheese', 'wrong', 1000);
    items = applyItemEvent(items, 'vocab', 'food', 'der Käse', 'cheese', 'almost', 2000);
    items = applyItemEvent(items, 'vocab', 'food', 'der Käse', 'cheese', 'correct', 3000);
    expect(items['vocab:food:der Käse'].wrongCount).toBe(2);
    expect(items['vocab:food:der Käse'].attempts).toBe(3);
  });

  it('does not mutate the input items object', () => {
    const before = {};
    applyItemEvent(before, 'alphabet', '', 'O', 'Ofen — oven', 'wrong', 1000);
    expect(before).toEqual({});
  });

  it('throws on an invalid tab', () => {
    expect(() => applyItemEvent({}, 'nope', '', 'X', '', 'wrong', 1)).toThrow(/tab/);
  });

  it('throws on an invalid verdict', () => {
    expect(() => applyItemEvent({}, 'vocab', 'food', 'X', '', 'maybe', 1)).toThrow(/verdict/);
  });

  it('enforces an LRU cap, evicting the oldest items by lastTs', () => {
    let items = {};
    // Use cap=3 so we can verify eviction behavior with manageable numbers.
    items = applyItemEvent(items, 'vocab', 'food', 'das Brot', 'bread', 'wrong', 1, 3);
    items = applyItemEvent(items, 'vocab', 'food', 'der Käse', 'cheese', 'wrong', 2, 3);
    items = applyItemEvent(items, 'vocab', 'food', 'die Milch', 'milk', 'wrong', 3, 3);
    items = applyItemEvent(items, 'vocab', 'food', 'das Wasser', 'water', 'wrong', 4, 3);
    expect(Object.keys(items)).toHaveLength(3);
    expect(items['vocab:food:das Brot']).toBeUndefined(); // oldest evicted
    expect(items['vocab:food:das Wasser']).toBeDefined();
  });
});

// ─── getReviewItems ───────────────────────────────────────────

describe('getReviewItems', () => {
  it('returns only items whose lastVerdict is not "correct"', () => {
    let items = {};
    items = applyItemEvent(items, 'vocab', 'food', 'das Brot', 'bread', 'wrong', 1000);
    items = applyItemEvent(items, 'vocab', 'food', 'der Käse', 'cheese', 'correct', 2000);
    items = applyItemEvent(items, 'vocab', 'food', 'die Milch', 'milk', 'almost', 3000);

    const review = getReviewItems(items);
    expect(review).toHaveLength(2);
    const labels = review.map((r) => r.label);
    expect(labels).toContain('das Brot');
    expect(labels).toContain('die Milch');
    expect(labels).not.toContain('der Käse');
  });

  it('sorts by lastTs descending (most recently failed first)', () => {
    let items = {};
    items = applyItemEvent(items, 'vocab', 'food', 'das Brot', 'bread', 'wrong', 1000);
    items = applyItemEvent(items, 'vocab', 'food', 'die Milch', 'milk', 'wrong', 3000);
    items = applyItemEvent(items, 'vocab', 'food', 'der Käse', 'cheese', 'wrong', 2000);

    const review = getReviewItems(items);
    expect(review.map((r) => r.label)).toEqual(['die Milch', 'der Käse', 'das Brot']);
  });

  it('respects the limit parameter', () => {
    let items = {};
    for (let i = 0; i < 20; i++) {
      items = applyItemEvent(items, 'vocab', 'food', `word-${i}`, '', 'wrong', i + 1);
    }
    expect(getReviewItems(items, 5)).toHaveLength(5);
    expect(getReviewItems(items, 10)).toHaveLength(10);
    expect(getReviewItems(items)).toHaveLength(10); // default 10
  });

  it('returns an empty array when no items qualify', () => {
    let items = {};
    items = applyItemEvent(items, 'vocab', 'food', 'X', '', 'correct', 1);
    expect(getReviewItems(items)).toEqual([]);
  });

  it('includes the key on each returned item (for navigation)', () => {
    let items = {};
    items = applyItemEvent(
      items,
      'translate',
      'a1',
      'I drink water.',
      'Ich trinke Wasser.',
      'wrong',
      1
    );
    const [item] = getReviewItems(items);
    expect(item.key).toBe('translate:a1:I drink water.');
  });
});

// ─── recordItem ───────────────────────────────────────────────

describe('recordItem', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists an item to localStorage under state.items', () => {
    recordItem('alphabet', '', 'O', 'Ofen — oven', 'wrong');
    const state = loadState();
    expect(state.items['alphabet::O']).toMatchObject({
      tab: 'alphabet',
      context: '',
      label: 'O',
      detail: 'Ofen — oven',
      lastVerdict: 'wrong',
      attempts: 1,
      wrongCount: 1,
    });
  });

  it('preserves daily, stats, and learnedWords on the saved state', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stats: { streak: 4, learnedCount: 8 },
        learnedWords: { Hallo: true },
        daily: { '2026-06-05': { total: 5, byTab: {}, byLevel: {} } },
      })
    );
    recordItem('vocab', 'food', 'das Brot', 'bread', 'wrong');
    const state = loadState();
    expect(state.stats.streak).toBe(4);
    expect(state.learnedWords.Hallo).toBe(true);
    expect(state.daily['2026-06-05']).toBeDefined();
    expect(state.items['vocab:food:das Brot']).toBeDefined();
  });

  it('silently no-ops when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => recordItem('vocab', 'food', 'X', 'x', 'wrong')).not.toThrow();
  });
});
