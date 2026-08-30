// Daily quests — derived, never stored.
//
// Which quests today holds is a pure function of a seed; how far along they are
// is a pure read over `daily[todayKey]`, which already syncs. Nothing here is
// persisted, so nothing here can desync: quests deliberately do not participate
// in the LWW/union-merge semantics the deck and mastery epics were spent on.
//
// THE RULE THAT KEEPS IT THAT WAY
//
// A quest whose progress cannot be derived from a counter that already exists
// gets cut, not given storage. The design spec listed "clear your due pile"
// among the candidates; it does not survive its own rule — progress would be
// (due at midnight − due now), and the starting figure is nowhere recorded.
// It is reframed as "review N cards in Vokabeln", which `byTab.vocab` answers
// exactly.
//
// TARGETS ARE RELATIVE
//
// Production averages 4 answers a day. A flat "answer 10 cards" would be
// unreachable on a typical day, and a board of unreachable goals is worse than
// no board. Targets scale off the learner's own recent activity, with a floor
// so a returning learner is not handed a target of zero.
import { TABS } from './stats.js';

/** How many quests a day. Small on purpose: a board of five is a chore list. */
export const QUEST_COUNT = 3;

/** Trailing window used to size targets, and the floor under every target. */
export const BASELINE_DAYS = 7;
export const MIN_TARGET = 2;

// ─── Seeding ──────────────────────────────────────────────────
//
// FNV-1a. Deliberately not Math.random and deliberately not crypto: the whole
// point is that two devices, offline, reach the same answer for the same
// (user, day) with nothing shared between them.

export function hashSeed(input) {
  let h = 0x811c9dc5;
  const s = String(input ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    // h * 16777619, kept in 32 bits without overflowing into float territory.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * The seed for one learner's day.
 *
 * A signed-out learner has no userId; the day alone is enough, because the
 * cross-device property it exists to provide is vacuous with one device.
 */
export function seedFor(userId, todayKey) {
  return hashSeed(`${userId ?? 'guest'}:${todayKey}`);
}

// ─── Progress sources ─────────────────────────────────────────
//
// Every one of these reads a counter `applyEvent` already writes on each
// answer. None of them needs a counter of its own.

const dayTotal = (day) => day?.total ?? 0;
const tabCount = (day, tab) => day?.byTab?.[tab] ?? 0;
const tabsTouched = (day) => TABS.filter((t) => tabCount(day, t) > 0).length;
const verdictTotal = (day, verdict) =>
  Object.values(day?.byLevel ?? {}).reduce((n, lv) => n + (lv?.[verdict] ?? 0), 0);

/**
 * The learner's typical day, over the trailing window, EXCLUDING today —
 * today is what the quest is trying to move, so counting it would make the
 * target chase the progress.
 *
 * The median, not the mean: one 22-answer binge should not set tomorrow's bar.
 */
export function recentBaseline(daily, todayKey, days = BASELINE_DAYS) {
  const totals = Object.entries(daily ?? {})
    .filter(([day]) => day < todayKey)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, days)
    .map(([, d]) => d?.total ?? 0);

  if (totals.length === 0) return MIN_TARGET;
  const sorted = [...totals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  return Math.max(MIN_TARGET, median);
}

// ─── The catalogue ────────────────────────────────────────────
//
// `group` exists so a day cannot serve three variations of the same idea; the
// picker takes at most one quest per group.
//
// Copy lives in the pack, exactly as it does for missions: an entry carries an
// id, a target and a way to measure — never a word the learner reads.

export const QUEST_CATALOGUE = [
  {
    id: 'answer-cards',
    group: 'volume',
    tab: 'vocab',
    target: (base) => Math.max(MIN_TARGET, Math.round(base * 1.2)),
    progress: (day) => dayTotal(day),
  },
  {
    id: 'get-correct',
    group: 'accuracy',
    tab: 'vocab',
    target: (base) => Math.max(MIN_TARGET, Math.round(base * 0.6)),
    progress: (day) => verdictTotal(day, 'correct'),
  },
  {
    id: 'practise-tabs',
    group: 'breadth',
    tab: 'home',
    // Breadth is about the shape of the day, not its size, so this one is
    // deliberately absolute — and capped at what the app actually offers.
    target: () => Math.min(3, TABS.length),
    progress: (day) => tabsTouched(day),
  },
  // ONE shared group across all four. Giving each its own group made the
  // dedup guard inert — three tab-focus quests are three variations of the same
  // idea, which is exactly what the guard exists to prevent.
  ...TABS.map((tab) => ({
    id: `focus-${tab}`,
    group: 'focus',
    tab,
    target: (base) => Math.max(MIN_TARGET, Math.round(base * 0.5)),
    progress: (day) => tabCount(day, tab),
  })),
];

// ─── Selection ────────────────────────────────────────────────

/**
 * Deterministically choose today's quests.
 *
 * Ranks the catalogue by a hash of (seed, quest id) and takes the best of each
 * group. Ranking rather than shuffling keeps it stable and independent of array
 * order, so adding a quest to the catalogue does not reshuffle everyone's day.
 */
export function pickQuests(catalogue, seed, count = QUEST_COUNT) {
  const ranked = (catalogue ?? [])
    .map((q) => ({ q, rank: hashSeed(`${seed}:${q.id}`) }))
    .sort((a, b) => a.rank - b.rank || (a.q.id < b.q.id ? -1 : 1));

  const seen = new Set();
  const out = [];
  for (const { q } of ranked) {
    if (out.length >= count) break;
    if (seen.has(q.group)) continue;
    seen.add(q.group);
    out.push(q);
  }
  return out;
}

/**
 * Today's quests, with progress.
 *
 * @param {object} args
 * @param {string} [args.userId]
 * @param {string} args.todayKey
 * @param {Record<string, object>} [args.daily] the synced day map
 * @param {number} [args.count]
 * @returns {Array<{id: string, target: number, progress: number, done: boolean, tab: string}>}
 */
export function deriveQuests({ userId, todayKey, daily = null, count = QUEST_COUNT } = {}) {
  if (!todayKey) return [];

  const day = daily?.[todayKey] ?? null;
  const base = recentBaseline(daily, todayKey);
  const seed = seedFor(userId, todayKey);

  return pickQuests(QUEST_CATALOGUE, seed, count).map((q) => {
    // No outer clamp: every catalogue entry floors its own target at
    // MIN_TARGET, and recentBaseline never returns less than that. A second
    // clamp here would be unreachable — the quests.test.js catalogue guard
    // enforces the invariant instead, where a violation fails loudly rather
    // than being silently corrected.
    const target = q.target(base);
    // Clamped so a finished quest reads "7 / 7" rather than "9 / 7".
    const progress = Math.min(q.progress(day), target);
    return { id: q.id, target, progress, done: progress >= target, tab: q.tab };
  });
}

/** How many of today's quests are complete — the input a badge would test. */
export function questsCompleted(quests) {
  return (quests ?? []).filter((q) => q?.done).length;
}
