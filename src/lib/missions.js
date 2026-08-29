// Open missions — what the learner could usefully do next.
//
// PURE (no storage/DOM), mirroring gamification.js. Every input is handed in
// already computed, and `now` is injected because streak-risk depends on the
// local hour and must be testable without faking global time.
//
// It returns DATA, never copy. Rendering resolves each `id` to a pack string,
// which is what keeps src/lib language-blind — a German sentence here would be
// exactly the regression the pack extraction was built to prevent.

/**
 * Fixed order, highest urgency first. Deterministic on purpose: a board that
 * reshuffled between renders would move under the reader's finger, and could
 * not be asserted.
 */
export const MISSION_PRIORITY = [
  'srs-due',
  'streak-risk',
  'goal-remaining',
  'revisit-wrong',
  'deck-unfinished',
  'league-position',
  'badge-near',
];

/** Home is a glance, not a backlog. */
export const MISSION_CAP = 5;

/** Local hour from which an unmet goal reads as a streak at risk. */
export const EVENING_HOUR = 18;

// "Within one step" cannot be read off a boolean predicate — the threshold
// lives inside the closure. So probe it: nudge each numeric field of the
// context by one and see whether the predicate flips. Generic, and it avoids
// duplicating every achievement's threshold in a second place that could drift.
function isOneStepAway(achievement, ctx) {
  if (typeof achievement?.test !== 'function' || !ctx) return false;
  try {
    if (achievement.test(ctx)) return false; // already true, so not "near"
    return Object.entries(ctx).some(([key, value]) => {
      if (!Number.isFinite(value)) return false;
      return achievement.test({ ...ctx, [key]: value + 1 });
    });
  } catch {
    // A predicate that throws on a nudged shape is not a mission.
    return false;
  }
}

/**
 * @returns {Array<{id: string, count: number, tab: string, priority: number}>}
 */
export function deriveMissions({
  srsDue = 0,
  goal = null,
  streak = 0,
  reviewItems = null,
  decks = null,
  league = null,
  achievements = null,
  achievementCtx = null,
  earned = null,
  now = new Date(),
  lastTab = 'chat',
  cap = MISSION_CAP,
} = {}) {
  const items = Array.isArray(reviewItems) ? reviewItems : [];
  const deckList = Array.isArray(decks) ? decks : [];
  const badges = Array.isArray(achievements) ? achievements : [];
  const earnedIds = Array.isArray(earned) ? earned : [];
  const goalMet = goal ? goal.met : true;

  // Started but not finished. An untouched deck is an invitation, not an open
  // task, and a finished one is neither.
  const started = deckList.find((d) => d && d.done > 0 && d.done < d.total);
  const near = badges.find((b) => !earnedIds.includes(b?.id) && isOneStepAway(b, achievementCtx));

  // Keyed by id, deliberately NOT an array. Emission order below is driven by
  // MISSION_PRIORITY alone, so the order has exactly one source. An earlier
  // draft built an array and sorted it, which meant declaration order and the
  // priority list both encoded the order — and because they happened to agree,
  // deleting the sort broke no test. One source cannot drift out of step with
  // itself.
  const candidates = {
    'srs-due': srsDue > 0 && { count: srsDue, tab: 'vocab' },

    'streak-risk': streak > 0 &&
      !goalMet &&
      now.getHours() >= EVENING_HOUR && { count: streak, tab: lastTab },

    'goal-remaining': goal &&
      !goal.met && {
        count: Math.max(0, (goal.target ?? 0) - (goal.current ?? 0)),
        tab: lastTab,
      },

    // Route to where the first wrong answer happened, so the fix is one tap.
    'revisit-wrong': items.length > 0 && {
      count: items.length,
      tab: items[0]?.tab ?? lastTab,
    },

    'deck-unfinished': started && {
      count: started.total - started.done,
      tab: 'vocab',
      deckId: started.deckId,
    },

    'league-position': league?.inDemotionZone && {
      count: league.rank ?? 0,
      tab: 'stats',
    },

    'badge-near': near && { count: 1, tab: lastTab, badgeId: near.id },
  };

  return MISSION_PRIORITY.filter((id) => candidates[id])
    .map((id, index) => ({ id, ...candidates[id], priority: MISSION_PRIORITY.indexOf(id), index }))
    .slice(0, cap)
    .map(({ index: _index, ...mission }) => mission);
}
