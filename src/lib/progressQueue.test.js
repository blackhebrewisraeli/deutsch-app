import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyEvent } from './stats.js';
import {
  QUEUE_KEY,
  enqueue,
  loadQueue,
  saveQueue,
  eventsFromCounters,
  countersFromQueue,
  expandGuestBacklog,
  flushQueue,
  flushNow,
  __setFlushHooksForTest,
  newEventId,
} from './progressQueue.js';

const ID = '11111111-1111-4111-8111-111111111111';
const event = (over = {}) => ({
  id: ID,
  dateKey: '2026-09-04',
  packId: 'de',
  tab: 'vocab',
  level: 'a1',
  verdict: 'correct',
  bonusXp: 0,
  ...over,
});

beforeEach(() => localStorage.clear());

describe('progressQueue persist', () => {
  it('persists under deutsch-app-progress-queue-v1, not the state blob', () => {
    enqueue(event());
    expect(localStorage.getItem('deutsch-app-state-v1')).toBeNull();
    expect(JSON.parse(localStorage.getItem(QUEUE_KEY))).toHaveLength(1);
  });

  it('does not enqueue the same id twice', () => {
    enqueue(event());
    enqueue(event());
    expect(loadQueue()).toHaveLength(1);
  });
});

describe('eventsFromCounters', () => {
  it('round-trips through applyEvent', () => {
    let daily = {};
    daily = applyEvent(daily, '2026-09-04', 'vocab', 'a1', 'correct', 5);
    daily = applyEvent(daily, '2026-09-04', 'chat', 'a1', 'wrong', 0);
    const events = eventsFromCounters('2026-09-04', 'de', daily['2026-09-04']);
    let replayed = {};
    for (const e of events) {
      replayed = applyEvent(replayed, e.dateKey, e.tab, e.level, e.verdict, e.bonusXp);
    }
    expect(replayed['2026-09-04'].total).toBe(2);
    expect(replayed['2026-09-04'].bonusXp).toBe(5);
    expect(replayed['2026-09-04'].byTab.vocab).toBe(1);
    expect(replayed['2026-09-04'].byTab.chat).toBe(1);
    expect(replayed['2026-09-04'].byLevel.a1.correct).toBe(1);
    expect(replayed['2026-09-04'].byLevel.a1.wrong).toBe(1);
  });
});

describe('expandGuestBacklog', () => {
  it('synthesises only the leftover not already queued or remote', () => {
    const local = {
      '2026-09-04': {
        total: 2,
        bonusXp: 0,
        byTab: { chat: 1, alphabet: 0, vocab: 1, translate: 0 },
        byLevel: {
          a1: { correct: 2, almost: 0, wrong: 0 },
          a2: { correct: 0, almost: 0, wrong: 0 },
          b1: { correct: 0, almost: 0, wrong: 0 },
        },
      },
    };
    const queue = [event({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tab: 'vocab' })];
    const extra = expandGuestBacklog({ localDaily: local, remoteDaily: {}, queue });
    expect(extra).toHaveLength(1);
    expect(extra[0].tab).toBe('chat');
  });
});

describe('flushQueue', () => {
  it('POSTs each event and drops it on 200', async () => {
    enqueue(event());
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ counters: { total: 1 } }),
      headers: { get: () => null },
    });
    await flushQueue({ fetchImpl, token: 'tok' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/progress/events');
    expect(loadQueue()).toEqual([]);
  });

  it('does not POST without a token', async () => {
    enqueue(event());
    const fetchImpl = vi.fn();
    await flushQueue({ fetchImpl, token: null });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loadQueue()).toHaveLength(1);
  });

  it('keeps the event on 5xx', async () => {
    enqueue(event());
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
    });
    await flushQueue({ fetchImpl, token: 'tok' });
    expect(loadQueue()).toHaveLength(1);
  });

  // An answer can land while a flush is mid-POST. The flush must not write its
  // stale snapshot back over it: that event would never be sent at all.
  it('keeps an event enqueued while an earlier POST is in flight', async () => {
    const LATE = '22222222-2222-4222-8222-222222222222';
    enqueue(event());
    const sent = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      sent.push(body.id);
      if (body.id === ID) enqueue(event({ id: LATE }));
      return { ok: true, status: 200, headers: { get: () => null } };
    });
    await flushQueue({ fetchImpl, token: 'tok' });
    const kept = loadQueue().map((e) => e.id);
    expect([...sent, ...kept]).toContain(LATE);
  });

  // Storage can refuse writes (quota, private mode). The flush must still send
  // each event once and stop, not re-POST an un-removable head forever.
  it('sends each event once and stops when storage refuses writes', async () => {
    enqueue(event());
    enqueue(event({ id: '33333333-3333-4333-8333-333333333333' }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // A 500 after a few calls ends a runaway loop, so a regression fails on
    // the count below instead of hanging the worker.
    const fetchImpl = vi.fn(async () => ({
      ok: fetchImpl.mock.calls.length <= 5,
      status: fetchImpl.mock.calls.length <= 5 ? 200 : 500,
      headers: { get: () => null },
    }));
    await flushQueue({ fetchImpl, token: 'tok' });
    setItem.mockRestore();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries 429 then continues', async () => {
    enqueue(event());
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => '0' } })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: { get: () => null },
      });
    await flushQueue({ fetchImpl, token: 'tok', sleep: async () => {} });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(loadQueue()).toEqual([]);
  });
});

describe('flushNow', () => {
  it('POSTs the queue when a token exists', async () => {
    enqueue(event());
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchImpl);
    __setFlushHooksForTest({
      getAccessToken: async () => 'tok',
      loadRemoteDaily: async () => ({}),
    });
    await flushNow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/progress/events');
    expect(loadQueue()).toEqual([]);
    vi.unstubAllGlobals();
  });

  // Offline with a cached JWT: the stats_daily read fails, and a failed read
  // is not an empty server. Treating it as {} re-queued the whole local
  // history under fresh ids, which the RPC then counted a second time.
  it('does not synthesise backlog when the remote read is unknown (null)', async () => {
    localStorage.setItem(
      'deutsch-app-state-v1',
      JSON.stringify({ daily: applyEvent({}, '2026-09-01', 'vocab', 'a1', 'correct', 0) })
    );
    enqueue(event());
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', fetchImpl);
    __setFlushHooksForTest({
      getAccessToken: async () => 'tok',
      loadRemoteDaily: async () => null,
    });
    await flushNow();
    // The queued event is idempotent and still goes; the history does not.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).id).toBe(ID);
    expect(loadQueue()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('does not POST without a token', async () => {
    enqueue(event());
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    __setFlushHooksForTest({
      getAccessToken: async () => null,
      loadRemoteDaily: async () => ({}),
    });
    await flushNow();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(loadQueue()).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

describe('newEventId', () => {
  it('returns a UUID', () => {
    expect(newEventId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('saveQueue', () => {
  it('replaces the stored list', () => {
    saveQueue([event(), event({ id: '22222222-2222-4222-8222-222222222222' })]);
    expect(loadQueue()).toHaveLength(2);
  });
});

describe('countersFromQueue', () => {
  it('sums queued events per day', () => {
    const c = countersFromQueue([
      event(),
      event({ id: '22222222-2222-4222-8222-222222222222', tab: 'chat' }),
    ]);
    expect(c['2026-09-04'].total).toBe(2);
    expect(c['2026-09-04'].byTab.vocab).toBe(1);
    expect(c['2026-09-04'].byTab.chat).toBe(1);
  });
});
