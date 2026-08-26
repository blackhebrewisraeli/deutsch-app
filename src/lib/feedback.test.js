import { describe, it, expect, vi, afterEach } from 'vitest';
import { FEEDBACK_CATEGORIES, buildFeedbackRow, submitFeedback } from './feedback';

const context = {
  surface: 'vocab',
  level: 'a2',
  deckId: 'artikel-common',
  itemId: 'de-zeit-noun',
  itemLabel: 'die Zeit',
};

describe('FEEDBACK_CATEGORIES', () => {
  it('covers the three problems the brief names', () => {
    const keys = FEEDBACK_CATEGORIES.map((c) => c.key);
    expect(keys).toEqual(['translation', 'ui', 'audio']);
  });

  it('gives every category a human label for the picker', () => {
    expect(FEEDBACK_CATEGORIES).toHaveLength(3); // else the loop is vacuous
    for (const c of FEEDBACK_CATEGORIES) {
      expect(c.label).toEqual(expect.any(String));
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

describe('buildFeedbackRow', () => {
  it('carries the whole exercise context, not just the learner text', () => {
    const row = buildFeedbackRow({ ...context, category: 'translation', message: 'wrong gender' });

    expect(row).toMatchObject({
      surface: 'vocab',
      cefr_level: 'a2',
      deck_id: 'artikel-common',
      item_id: 'de-zeit-noun',
      item_label: 'die Zeit',
      category: 'translation',
      message: 'wrong gender',
    });
  });

  it('stamps an ISO timestamp a database can order by', () => {
    const row = buildFeedbackRow({ ...context, category: 'ui', message: 'x' });
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it('trims the learner message', () => {
    const row = buildFeedbackRow({ ...context, category: 'ui', message: '  spacing  ' });
    expect(row.message).toBe('spacing');
  });

  it('records a null rather than undefined for context a surface does not have', () => {
    // Translate has no deck. `undefined` disappears through JSON.stringify,
    // which would make a missing column and an absent value indistinguishable
    // at the far end of the wire.
    const row = buildFeedbackRow({
      surface: 'translate',
      level: 'b1',
      itemId: 'tr-14',
      itemLabel: 'The train is late.',
      category: 'translation',
      message: 'the answer is also valid',
    });
    expect(row.deck_id).toBeNull();
    expect(Object.hasOwn(row, 'deck_id')).toBe(true);
  });

  it('uses snake_case keys throughout so the row inserts as-is', () => {
    const row = buildFeedbackRow({ ...context, category: 'ui', message: 'x' });
    // else an empty row passes this trivially
    expect(Object.keys(row).length).toBeGreaterThanOrEqual(8);
    for (const key of Object.keys(row)) {
      expect(key, `${key} is not insert-ready`).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe('submitFeedback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports success and hands back the row it sent', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await submitFeedback({ ...context, category: 'audio', message: 'clipped' });

    expect(result.ok).toBe(true);
    expect(result.row).toMatchObject({ item_id: 'de-zeit-noun', category: 'audio' });
  });

  it('logs the payload so the mock transport is observable', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await submitFeedback({ ...context, category: 'audio', message: 'clipped' });

    expect(info).toHaveBeenCalledTimes(1);
    const [, row] = info.mock.calls[0];
    expect(row).toMatchObject({ surface: 'vocab', message: 'clipped' });
  });

  it('refuses an empty report rather than sending a blank row', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await submitFeedback({ ...context, category: 'ui', message: '   ' });

    expect(result.ok).toBe(false);
    expect(info).not.toHaveBeenCalled();
  });

  it('resolves rather than throwing when the transport fails', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('transport down');
    });
    const result = await submitFeedback({ ...context, category: 'ui', message: 'x' });
    expect(result.ok).toBe(false);
  });
});
