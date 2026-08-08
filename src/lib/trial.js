// Guest-trial derivation — pure, I/O-free. Like streak.js, every number is
// DERIVED from the daily log the app already keeps: the trial adds no storage
// key and no migration.
//
// Day entries can be partial — an older schema, or a partial write merged in
// from remote state by sync/merge.js — so every nested container is
// optional-chained. A missing bucket degrades to 0; it never throws and never
// produces NaN. (Same reason as the note at stats.js:122.)
import { TABS } from './stats';
import { qualifies } from './streak';
import { DEFAULT_GOAL, TRIAL_ROUND_CAP, TRIAL_REQUIRES } from './gameConfig';

export function trialStatus(daily, gamification) {
  const days = Object.values(daily ?? {});
  const goal = gamification?.goal ?? DEFAULT_GOAL;

  const roundsUsed = days.reduce((sum, d) => sum + (d?.total ?? 0), 0);
  const tabsSampled = TABS.filter((tab) => days.some((d) => (d?.byTab?.[tab] ?? 0) > 0)).length;
  // qualifies() is the streak's own rule — reused so the trial and the streak
  // can never drift apart if that rule changes.
  const goalCompleted = days.some((d) => qualifies(d, goal));

  // The designed peak is the conjunction of whichever halves are switched on.
  // With both switched off it degenerates to "already peaked", which is the
  // literal meaning of dropping both requirements and not a config we ship.
  const peaked =
    (!TRIAL_REQUIRES.allTabs || tabsSampled === TABS.length) &&
    (!TRIAL_REQUIRES.firstGoal || goalCompleted);

  return {
    exhausted: peaked || roundsUsed >= TRIAL_ROUND_CAP,
    roundsUsed,
    tabsSampled,
    goalCompleted,
  };
}
