// Durable progress-event queue. Separate localStorage key from the state blob
// (same idea as syncMeta): answers must survive a quota failure on the main
// blob, and the queue is not part of the LWW settings merge.
//
// applyEvent still writes local daily for instant UI. This module is how those
// answers reach the RPC without a second writer on stats_daily.

import { applyEvent, TABS, LEVELS, VERDICTS } from './stats';
import { addCounters, subCounters, clampCounters } from './sync/merge';

export const QUEUE_KEY = 'deutsch-app-progress-queue-v1';

// Mirrors MAX_BONUS_XP in api/_lib/progressHandlers.js. src/ must not import
// from api/ (native ESM on Vercel is a different graph; this is client code).
const QUEUE_MAX_BONUS_XP = 500;

let idCounter = 0;

export function newEventId() {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) webCrypto.getRandomValues(bytes);
  else {
    idCounter += 1;
    for (let i = 0; i < 16; i += 1) bytes[i] = (Date.now() + idCounter + i) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue(events) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events));
  } catch {
    // quota / private mode — the in-memory caller still has the list this tick
  }
}

export function enqueue(event) {
  const q = loadQueue();
  if (q.some((e) => e.id === event.id)) return q;
  const next = [...q, event];
  saveQueue(next);
  return next;
}

export function eventsFromCounters(dateKey, packId, counters) {
  const slots = [];
  for (const level of LEVELS) {
    for (const verdict of VERDICTS) {
      const n = counters?.byLevel?.[level]?.[verdict] ?? 0;
      for (let i = 0; i < n; i += 1) slots.push({ level, verdict });
    }
  }
  const tabs = [];
  for (const tab of TABS) {
    const n = counters?.byTab?.[tab] ?? 0;
    for (let i = 0; i < n; i += 1) tabs.push(tab);
  }
  const n = Math.max(counters?.total ?? 0, slots.length, tabs.length);
  while (slots.length < n) slots.push({ level: 'a1', verdict: 'correct' });
  while (tabs.length < n) tabs.push('vocab');

  let bonusLeft = Math.max(0, counters?.bonusXp ?? 0);
  const events = [];
  for (let i = 0; i < n; i += 1) {
    const bonusXp = Math.min(QUEUE_MAX_BONUS_XP, bonusLeft);
    bonusLeft -= bonusXp;
    events.push({
      id: newEventId(),
      dateKey,
      packId,
      tab: tabs[i],
      level: slots[i].level,
      verdict: slots[i].verdict,
      bonusXp,
    });
  }
  return events;
}

export function countersFromQueue(events) {
  let daily = {};
  for (const e of events ?? []) {
    daily = applyEvent(daily, e.dateKey, e.tab, e.level, e.verdict, e.bonusXp ?? 0);
  }
  return daily;
}

export function expandGuestBacklog({ localDaily = {}, remoteDaily = {}, queue = [] } = {}) {
  const pending = countersFromQueue(queue);
  const extra = [];
  const days = new Set([
    ...Object.keys(localDaily ?? {}),
    ...Object.keys(remoteDaily ?? {}),
    ...Object.keys(pending),
  ]);
  for (const day of days) {
    const leftover = clampCounters(
      subCounters(localDaily[day], addCounters(remoteDaily[day], pending[day]))
    );
    if ((leftover?.total ?? 0) > 0) {
      extra.push(...eventsFromCounters(day, 'de', leftover));
    }
  }
  return extra;
}

async function defaultSleep(ms) {
  if (!ms) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function flushQueue({
  fetchImpl = globalThis.fetch,
  token,
  sleep = defaultSleep,
} = {}) {
  if (!token || typeof fetchImpl !== 'function') return;
  const MAX_RETRIES = 5;
  let q = loadQueue();
  while (q.length > 0) {
    const current = q[0];
    let retries = 0;
    let done = false;
    while (!done) {
      let res;
      try {
        res = await fetchImpl('/api/v1/progress/events', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(current),
        });
      } catch {
        return;
      }
      if (res?.ok || res?.status === 200) {
        q = q.slice(1);
        saveQueue(q);
        done = true;
        continue;
      }
      if (res?.status === 429 && retries < MAX_RETRIES) {
        retries += 1;
        const retryAfter = Number(res.headers?.get?.('Retry-After') ?? 1);
        await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000);
        continue;
      }
      return;
    }
  }
}

let flushTimer = null;
let flushing = false;
let flushAgain = false;
let onlineHandler = null;
let visibilityHandler = null;
let getToken = async () => null;
let getRemoteDaily = async () => ({});

export function __setFlushHooksForTest({ getAccessToken, loadRemoteDaily } = {}) {
  if (getAccessToken) getToken = getAccessToken;
  if (loadRemoteDaily) getRemoteDaily = loadRemoteDaily;
}

export async function flushNow() {
  if (flushing) {
    flushAgain = true;
    return;
  }
  flushing = true;
  try {
    do {
      flushAgain = false;
      const token = await getToken();
      if (!token) return;
      const queue = loadQueue();
      let localDaily = {};
      try {
        const raw = localStorage.getItem('deutsch-app-state-v1');
        localDaily = raw ? (JSON.parse(raw).daily ?? {}) : {};
      } catch {
        localDaily = {};
      }
      const remoteDaily = (await getRemoteDaily()) ?? {};
      const extra = expandGuestBacklog({ localDaily, remoteDaily, queue });
      if (extra.length) saveQueue([...extra, ...loadQueue()]);
      await flushQueue({ token });
    } while (flushAgain);
  } finally {
    flushing = false;
  }
}

export function startProgressFlush({ getAccessToken, loadRemoteDaily } = {}) {
  if (getAccessToken) getToken = getAccessToken;
  if (loadRemoteDaily) getRemoteDaily = loadRemoteDaily;
  if (typeof window === 'undefined') {
    void flushNow();
    return;
  }
  if (onlineHandler) window.removeEventListener('online', onlineHandler);
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
  onlineHandler = () => {
    void flushNow();
  };
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') void flushNow();
  };
  window.addEventListener('online', onlineHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  void flushNow();
}

export function stopProgressFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (typeof window !== 'undefined' && onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
  if (typeof document !== 'undefined' && visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

export function scheduleFlush(ms = 500) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushNow();
  }, ms);
}
