import { useState, useEffect } from 'react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS } from '../lib/theme';
import { loadState, saveState } from '../lib/storage';
import { stampSettings } from '../lib/settingsStamp';
import {
  todayKey,
  getTodaySnapshot,
  getHeatmapData,
  getPerTabBreakdown,
  getAccuracyByLevel,
  getReviewItems,
} from '../lib/stats';
import { levelFromXp, totalXp, DEFAULT_GOAL } from '../lib/gamification';
import { Hero, SectionLabel } from './UI';
import TodaySnapshot from './stats/TodaySnapshot';
import Heatmap, { HeatmapLegend } from './stats/Heatmap';
import PerTabBars from './stats/PerTabBars';
import AccuracyByLevel from './stats/AccuracyByLevel';
import ReviewFeed from './stats/ReviewFeed';
import VocabSrsWidget from './stats/VocabSrsWidget';
import LevelCard from './gamification/LevelCard';
import GoalPicker from './gamification/GoalPicker';
import BadgeGrid from './gamification/BadgeGrid';
import AccountSection from './stats/AccountSection';

// Section 05 — practice dashboard. Reads the forward-only event log from
// storage and composes six widgets (A–F). All aggregation lives in lib/stats
// + lib/srs; the widgets are pure presentation.
export default function StatsTab({ mobile = false, onReview, user, onSignIn, onSignOut }) {
  // Pull state from storage every render so today's counters reflect events
  // from the other tabs without app-wide state plumbing.
  const [state, setState] = useState(() => loadState() ?? {});

  // Re-read on focus so switching tabs picks up new events.
  useEffect(() => {
    const onFocus = () => setState(loadState() ?? {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const daily = state.daily ?? {};
  const items = state.items ?? {};
  const srs = state.srs ?? {};
  const stats = state.stats ?? { streak: 0, learnedCount: 0 };

  const today = todayKey();
  const nowMs = Date.now();
  const snap = getTodaySnapshot(daily, stats, today);
  const heatmap = getHeatmapData(daily, new Date(), 365);
  const perTab = getPerTabBreakdown(daily);
  const accByLevel = getAccuracyByLevel(daily);
  const review = getReviewItems(items, 10);

  return (
    <div>
      <Hero
        kicker="Section 05"
        title="Statistik"
        sub="A picture of your practice. Today's snapshot, the year so far, and how your effort breaks down across the four sections."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[8], marginTop: SPACE[8] }}>
        <section>
          <SectionLabel num="0" text="Fortschritt" />
          <LevelCard
            lvl={levelFromXp(totalXp(daily))}
            totalXp={totalXp(daily)}
            learnedCount={stats.learnedCount ?? 0}
          />
          <div style={{ marginTop: SPACE[5] }}>
            <SectionLabel num="·" text="Account & sync" />
            <AccountSection user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
          </div>
          <div style={{ marginTop: SPACE[5] }}>
            <SectionLabel num="·" text="Daily goal" />
            <GoalPicker
              goal={state.gamification?.goal ?? DEFAULT_GOAL}
              onPick={(xp) => {
                const s = loadState() ?? {};
                const g = {
                  ...(s.gamification ?? { soundOn: false, achievements: {}, lastGoalMet: null }),
                  goal: xp,
                };
                saveState({ ...s, gamification: g });
                stampSettings();
                setState(loadState() ?? {});
                window.dispatchEvent(new CustomEvent('deutsch:progress'));
              }}
            />
            <button
              type="button"
              onClick={() => {
                const s = loadState() ?? {};
                const cur = s.gamification ?? {
                  goal: DEFAULT_GOAL,
                  achievements: {},
                  lastGoalMet: null,
                };
                const g = { ...cur, soundOn: !cur.soundOn };
                saveState({ ...s, gamification: g });
                stampSettings();
                setState(loadState() ?? {});
                window.dispatchEvent(new CustomEvent('deutsch:progress'));
              }}
              style={{
                marginTop: SPACE[3],
                border: 'none',
                borderRadius: RADIUS.md,
                boxShadow: `0 4px 0 ${COLORS.lip}`,
                background: COLORS.card,
                color: COLORS.ink,
                padding: `${SPACE[2]}px ${SPACE[4]}px`,
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                letterSpacing: LETTER_SPACING.widest,
                cursor: 'pointer',
              }}
            >
              {(state.gamification?.soundOn ?? false) ? '🔊 SOUND: ON' : '🔇 SOUND: OFF'}
            </button>
          </div>
          <div style={{ marginTop: SPACE[5] }}>
            <SectionLabel num="·" text="Badges" />
            <BadgeGrid achievements={state.gamification?.achievements ?? {}} />
          </div>
        </section>

        <section>
          <SectionLabel num="A" text="Today" />
          <TodaySnapshot snap={snap} />
        </section>

        <section>
          <SectionLabel num="B" text="Last 12 months" />
          <Heatmap data={heatmap} mobile={mobile} />
          <HeatmapLegend />
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
            gap: SPACE[8],
          }}
        >
          <section>
            <SectionLabel num="C" text="By section" />
            <PerTabBars breakdown={perTab} />
          </section>

          <section>
            <SectionLabel num="D" text="Accuracy by level" />
            <AccuracyByLevel byLevel={accByLevel} />
          </section>
        </div>

        <section>
          <SectionLabel num="E" text="Review — tap to re-attempt" />
          <ReviewFeed items={review} onReview={onReview ?? (() => {})} />
        </section>

        <section>
          <SectionLabel num="F" text="Vocab review queue" />
          <VocabSrsWidget srs={srs} now={nowMs} />
        </section>
      </div>
    </div>
  );
}
