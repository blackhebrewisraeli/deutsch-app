import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createSignedInUser } from './helpers.js';

// Two properties, and they are different questions:
//   1. privilege — a signed-in client must NOT be able to call the RPC
//   2. arithmetic — the merge is ADDITIVE and matches applyEvent
// A single test that "the RPC works" would miss the first entirely.

const admin = adminClient();

const DAY = '2026-09-04';
let A;

const callAsService = (over = {}) =>
  admin.rpc('apply_progress_event', {
    p_user_id: A.id,
    p_pack_id: 'de',
    p_day: DAY,
    p_tab: 'vocab',
    p_level: 'a1',
    p_verdict: 'correct',
    p_bonus_xp: 0,
    p_event_id: crypto.randomUUID(),
    ...over,
  });

beforeAll(async () => {
  A = await createSignedInUser('progress-a');
});

afterAll(async () => {
  if (!A?.id) return;
  await admin.from('progress_events_seen').delete().eq('user_id', A.id);
  await admin.from('stats_daily').delete().eq('user_id', A.id);
});

describe('apply_progress_event: privilege', () => {
  it('a signed-in client CANNOT execute the RPC', async () => {
    const { error } = await A.client.rpc('apply_progress_event', {
      p_user_id: A.id,
      p_pack_id: 'de',
      p_day: DAY,
      p_tab: 'vocab',
      p_level: 'a1',
      p_verdict: 'correct',
      p_bonus_xp: 0,
      p_event_id: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });

  it('a signed-in client CANNOT execute the pure helper either', async () => {
    const { error } = await A.client.rpc('progress_counters_apply', {
      prev: {},
      p_tab: 'vocab',
      p_level: 'a1',
      p_verdict: 'correct',
      p_bonus_xp: 0,
    });
    expect(error).not.toBeNull();
  });
});

describe('apply_progress_event: arithmetic', () => {
  it('creates the row with a fully-normalised aggregate', async () => {
    const { data, error } = await callAsService();
    expect(error).toBeNull();
    expect(data.total).toBe(1);
    expect(data.bonusXp).toBe(0);
    // Every bucket present at 0 — the shape normalizeDayAggregate would produce.
    expect(Object.keys(data.byTab).sort()).toEqual(['alphabet', 'chat', 'translate', 'vocab']);
    expect(Object.keys(data.byLevel).sort()).toEqual(['a1', 'a2', 'b1']);
    expect(data.byTab.vocab).toBe(1);
    expect(data.byTab.chat).toBe(0);
    expect(data.byLevel.a1.correct).toBe(1);
    expect(data.byLevel.a1.wrong).toBe(0);
    expect(data.byLevel.b1.correct).toBe(0);
  });

  it('ADDS to the existing row rather than replacing it', async () => {
    const { data } = await callAsService({ p_tab: 'chat', p_verdict: 'almost', p_bonus_xp: 5 });
    expect(data.total).toBe(2);
    expect(data.bonusXp).toBe(5);
    // The first event's tab count survived — this is the whole point.
    expect(data.byTab.vocab).toBe(1);
    expect(data.byTab.chat).toBe(1);
    expect(data.byLevel.a1.correct).toBe(1);
    expect(data.byLevel.a1.almost).toBe(1);
  });

  it('heals a partially-written counters object instead of producing NULL', async () => {
    // Exactly what an older client or a merged remote day can leave behind.
    await admin
      .from('stats_daily')
      .update({ counters: { total: 7 } })
      .eq('user_id', A.id)
      .eq('day', DAY);
    const { data, error } = await callAsService();
    expect(error).toBeNull();
    expect(data.total).toBe(8);
    expect(data.byTab.vocab).toBe(1);
    expect(data.byLevel.a1.correct).toBe(1);
    expect(data.bonusXp).toBe(0);
  });

  it('rejects a tab, level or verdict outside the closed sets', async () => {
    const bad = await callAsService({ p_tab: 'dictation' });
    expect(bad.error).not.toBeNull();
    const bad2 = await callAsService({ p_level: 'c1' });
    expect(bad2.error).not.toBeNull();
    const bad3 = await callAsService({ p_verdict: 'perfect' });
    expect(bad3.error).not.toBeNull();
  });

  it('the pure helper itself raises on an out-of-set bucket, rather than returning NULL', async () => {
    // Unreachable through the endpoint (the writer validates first), but the
    // helper is exported as an independently testable unit and must not fail
    // silently: to_jsonb(NULL::integer) is strict, so an unvalidated bad tab
    // would otherwise make jsonb_set propagate NULL all the way out.
    const { error } = await admin.rpc('progress_counters_apply', {
      prev: {},
      p_tab: 'weird',
      p_level: 'a1',
      p_verdict: 'correct',
      p_bonus_xp: 0,
    });
    expect(error).not.toBeNull();
  });

  it('keeps concurrent events from clobbering each other', async () => {
    // The property the ON CONFLICT form exists for. A read-then-write
    // implementation passes every test above and fails this one.
    const day = '2026-09-05';
    const runs = Array.from({ length: 10 }, () => callAsService({ p_day: day }));
    await Promise.all(runs);
    const { data } = await admin
      .from('stats_daily')
      .select('counters')
      .eq('user_id', A.id)
      .eq('day', day)
      .single();
    expect(data.counters.total).toBe(10);
    expect(data.counters.byTab.vocab).toBe(10);
  });
});

describe('apply_progress_event: idempotency', () => {
  it('a replayed event_id does not increment again', async () => {
    const id = crypto.randomUUID();
    const day = '2026-09-06';
    const first = await callAsService({ p_day: day, p_event_id: id });
    expect(first.error).toBeNull();
    expect(first.data.total).toBe(1);
    const replay = await callAsService({ p_day: day, p_event_id: id });
    expect(replay.error).toBeNull();
    expect(replay.data.total).toBe(1);
    const { data } = await admin
      .from('stats_daily')
      .select('counters')
      .eq('user_id', A.id)
      .eq('day', day)
      .single();
    expect(data.counters.total).toBe(1);
  });

  it('a signed-in client CANNOT insert into progress_events_seen', async () => {
    const { error } = await A.client.from('progress_events_seen').insert({
      user_id: A.id,
      event_id: crypto.randomUUID(),
    });
    expect(error).not.toBeNull();
  });
});
