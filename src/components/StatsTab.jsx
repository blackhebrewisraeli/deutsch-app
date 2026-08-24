import { useState, useEffect } from 'react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS, SHADOW } from '../lib/theme';
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
import LevelSwitcher from './ui/LevelSwitcher';
import BadgeGrid from './gamification/BadgeGrid';
import AccountSection from './stats/AccountSection';
import LeaderboardSection from './stats/LeaderboardSection';
import ProfileCard from './stats/ProfileCard';
import { LEAGUES_ENABLED } from '../lib/leagues.js';
import { isAuthConfigured } from '../lib/auth.js';
import { writeLevel, LEVEL_NAMES, LEVEL_MODES } from '../lib/levelPref';
import { LEVEL_MULTIPLIERS } from '../lib/gameConfig';

// Section 05 — practice dashboard. Reads the forward-only event log from
// storage and composes six widgets (A–F). All aggregation lives in lib/stats
// + lib/srs; the widgets are pure presentation.
export default function StatsTab({
  mobile = false,
  onReview,
  user,
  onSignIn,
  onSignOut,
  onExport,
  onDelete,
  lastSyncedAt = null,
  level = 'a1',
  onLevelChange = () => {},
  levelBoost = false,
}) {
  // Pull state from storage every render so today's counters reflect events
  // from the other tabs without app-wide state plumbing.
  const [state, setState] = useState(() => loadState() ?? {});
  const [activeView, setActiveView] = useState('stats');
  const [selectedUser, setSelectedUser] = useState(null);

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

  const NAV_BUTTON_BASE = {
    border: 'none',
    borderRadius: RADIUS.md,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.sm,
    letterSpacing: LETTER_SPACING.widest,
    padding: `${SPACE[2]}px ${SPACE[4]}px`,
    cursor: 'pointer',
  };

  return (
    <div>
      {LEAGUES_ENABLED && (
        <div style={{ display: 'flex', gap: SPACE[3], marginBottom: SPACE[4] }}>
          <button
            type="button"
            onClick={() => setActiveView('stats')}
            style={{
              ...NAV_BUTTON_BASE,
              background: activeView === 'stats' ? COLORS.ink : COLORS.card,
              color: activeView === 'stats' ? COLORS.paper : COLORS.ink,
              boxShadow: SHADOW.press(COLORS.lip),
            }}
          >
            STATS
          </button>
          <button
            type="button"
            aria-label="leagues"
            onClick={() => setActiveView('leagues')}
            style={{
              ...NAV_BUTTON_BASE,
              background: activeView === 'leagues' ? COLORS.ink : COLORS.card,
              color: activeView === 'leagues' ? COLORS.paper : COLORS.ink,
              boxShadow: SHADOW.press(COLORS.lip),
            }}
          >
            LEAGUES
          </button>
        </div>
      )}

      {LEAGUES_ENABLED && selectedUser && (
        <ProfileCard userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {LEAGUES_ENABLED && activeView === 'leagues' ? (
        <div>
          <Hero
            kicker="Section 06"
            title="Ligen"
            sub="Compete with learners at your level. Weekly XP decides who advances."
          />
          <div style={{ marginTop: SPACE[8] }}>
            <LeaderboardSection onSelectUser={setSelectedUser} />
          </div>
        </div>
      ) : (
        <div>
          <Hero
            kicker="Section 06"
            title="Statistik"
            sub="A picture of your practice. Today's snapshot, the year so far, and how your effort breaks down across the four sections."
          />

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: SPACE[8], marginTop: SPACE[8] }}
          >
            <section>
              <SectionLabel num="0" text="Fortschritt" />
              <LevelCard
                lvl={levelFromXp(totalXp(daily))}
                totalXp={totalXp(daily)}
                learnedCount={stats.learnedCount ?? 0}
              />
              {/* AccountSection renders null for a guest when no auth backend is
                  configured; without this the "Account & sync" label would sit
                  above an empty block. */}
              {(user || isAuthConfigured()) && (
                <div style={{ marginTop: SPACE[5] }}>
                  <SectionLabel num="·" text="Account & sync" />
                  <AccountSection
                    user={user}
                    onSignIn={onSignIn}
                    onSignOut={onSignOut}
                    onExport={onExport}
                    onDelete={onDelete}
                    lastSyncedAt={lastSyncedAt}
                  />
                </div>
              )}
              <div style={{ marginTop: SPACE[5] }}>
                <SectionLabel num="·" text="Daily goal" />
                <GoalPicker
                  goal={state.gamification?.goal ?? DEFAULT_GOAL}
                  onPick={(xp) => {
                    const s = loadState() ?? {};
                    const g = {
                      ...(s.gamification ?? {
                        soundOn: false,
                        achievements: {},
                        lastGoalMet: null,
                      }),
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
                    boxShadow: SHADOW.press(COLORS.lip),
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
                <SectionLabel num="·" text="Learning level" />
                <LevelSwitcher
                  value={level}
                  variant="full"
                  onChange={(next) => {
                    writeLevel(next);
                    onLevelChange(next);
                  }}
                />
                <div
                  style={{
                    marginTop: SPACE[3],
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    letterSpacing: LETTER_SPACING.caps,
                    color: COLORS.mute,
                  }}
                >
                  {LEVEL_NAMES[level] ?? ''}
                  {levelBoost && (LEVEL_MULTIPLIERS[level] ?? 1) > 1
                    ? ` · ×${LEVEL_MULTIPLIERS[level]} XP per answer`
                    : ''}
                </div>
                {/* What the level actually changes, in the learner's terms.
                    Printed verbatim, never case-transformed: lowercasing the
                    detail turned B1's "AI-graded" into "ai-graded". */}
                {LEVEL_MODES[level] && (
                  <div
                    style={{
                      marginTop: SPACE[2],
                      fontFamily: FONTS.body,
                      fontSize: FONT_SIZE.base,
                      color: COLORS.inkSoft,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    Translate exercises: <strong>{LEVEL_MODES[level].label}</strong> —{' '}
                    {LEVEL_MODES[level].detail}.
                  </div>
                )}
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
                gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
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
      )}
    </div>
  );
}
