import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMock = vi.hoisted(() => ({ client: null }));
vi.mock('./auth.js', () => ({
  getSupabase: () => Promise.resolve(authMock.client),
}));

import { FEEDBACK_CATEGORIES, buildFeedbackRow, submitFeedback } from './feedback';

const context = {
  surface: 'vocab',
  level: 'a2',
  deckId: 'artikel-common',
  itemId: 'de-zeit-noun',
  itemLabel: 'die Zeit',
};

/** Minimal PostgREST insert chain: from('feedback').insert(row). */
function supabaseInserting({ error = null, userId = null, throwOnInsert = false } = {}) {
  const insert = vi.fn(() => {
    if (throwOnInsert) throw new Error('transport down');
    return Promise.resolve({ error });
  });
  const from = vi.fn(() => ({ insert }));
  const getSession = vi.fn().mockResolvedValue({
    data: { session: userId ? { user: { id: userId } } : null },
  });
  return { client: { from, auth: { getSession } }, from, insert, getSession };
}

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
  beforeEach(() => {
    authMock.client = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to a local log when auth is unconfigured, and still reports success', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await submitFeedback({ ...context, category: 'audio', message: 'clipped' });

    expect(result.ok).toBe(true);
    expect(result.row).toMatchObject({ item_id: 'de-zeit-noun', category: 'audio' });
    expect(info).toHaveBeenCalledTimes(1);
    const [, row] = info.mock.calls[0];
    expect(row).toMatchObject({ surface: 'vocab', message: 'clipped' });
  });

  it('inserts the row into feedback when a client is available', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = supabaseInserting({ userId: 'user-1' });
    authMock.client = s.client;

    const result = await submitFeedback({ ...context, category: 'audio', message: 'clipped' });

    expect(result.ok).toBe(true);
    expect(s.from).toHaveBeenCalledWith('feedback');
    expect(s.insert).toHaveBeenCalledTimes(1);
    expect(s.insert.mock.calls[0][0]).toMatchObject({
      surface: 'vocab',
      cefr_level: 'a2',
      deck_id: 'artikel-common',
      item_id: 'de-zeit-noun',
      item_label: 'die Zeit',
      category: 'audio',
      message: 'clipped',
      user_id: 'user-1',
    });
    expect(result.row).toMatchObject({ user_id: 'user-1', category: 'audio' });
    expect(info).not.toHaveBeenCalled();
  });

  it('attributes a signed-out session as a null user_id so the guest insert policy matches', async () => {
    const s = supabaseInserting({ userId: null });
    authMock.client = s.client;

    const result = await submitFeedback({ ...context, category: 'ui', message: 'confusing' });

    expect(result.ok).toBe(true);
    expect(s.insert.mock.calls[0][0].user_id).toBeNull();
    expect(Object.hasOwn(s.insert.mock.calls[0][0], 'user_id')).toBe(true);
  });

  it('refuses an empty report rather than sending a blank row', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = supabaseInserting();
    authMock.client = s.client;
    const result = await submitFeedback({ ...context, category: 'ui', message: '   ' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('empty');
    expect(s.from).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('resolves rather than throwing when the insert returns an error', async () => {
    const s = supabaseInserting({ error: { message: 'offline', code: 'PGRST301' } });
    authMock.client = s.client;
    const result = await submitFeedback({ ...context, category: 'ui', message: 'x' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ message: 'offline' });
  });

  it('resolves rather than throwing when the transport throws', async () => {
    const s = supabaseInserting({ throwOnInsert: true });
    authMock.client = s.client;
    const result = await submitFeedback({ ...context, category: 'ui', message: 'x' });
    expect(result.ok).toBe(false);
  });
});
