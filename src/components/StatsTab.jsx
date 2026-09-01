import { useState, useEffect } from 'react';
import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE, RADIUS, SHADOW } from '../lib/theme';
import { loadState } from '../lib/storage';
import {
  todayKey,
  getTodaySnapshot,
  getHeatmapData,
  getPerTabBreakdown,
  getAccuracyByLevel,
  getReviewItems,
} from '../lib/stats';
import { score } from '../lib/gamification';
import { Hero, SectionLabel } from './UI';
import TodaySnapshot from './stats/TodaySnapshot';
import Heatmap, { HeatmapLegend } from './stats/Heatmap';
import PerTabBars from './stats/PerTabBars';
import AccuracyByLevel from './stats/AccuracyByLevel';
import ReviewFeed from './stats/ReviewFeed';
import VocabSrsWidget from './stats/VocabSrsWidget';
import LevelCard from './gamification/LevelCard';
import BadgeGrid from './gamification/BadgeGrid';
import Button from './ui/Button';
import LeaderboardSection from './stats/LeaderboardSection';
import ProfileCard from './stats/ProfileCard';
import { LEAGUES_ENABLED } from '../lib/leagues.js';
import { isAuthConfigured } from '../lib/auth.js';

const VIEWS = {
  stats: 'stats',
  leagues: 'leagues',
  settings: 'settings',
};

const NAV_BUTTON_BASE = {
  border: 'none',
  borderRadius: RADIUS.md,
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.sm,
  letterSpacing: LETTER_SPACING.widest,
  padding: `${SPACE[2]}px ${SPACE[4]}px`,
  cursor: 'pointer',
};

// Section 06 — the Profile tab. Three views behind one segmented control:
// practice dashboard, weekly leagues, and Settings. Goal and level editing
// live only in Settings, so this surface cannot drift into a second copy
// of the same writers.
export default function StatsTab({
  mobile = false,
  onReview,
  user,
  onSignIn,
  view,
  onViewChange,
  settingsPanel = null,
}) {
  const [state, setState] = useState(() => loadState() ?? {});
  const [internalView, setInternalView] = useState(VIEWS.stats);
  const [selectedUser, setSelectedUser] = useState(null);

  const controlled = typeof view === 'string' && typeof onViewChange === 'function';
  const activeView = controlled ? view : internalView;
  const setActiveView = (next) => {
    if (controlled) onViewChange(next);
    else setInternalView(next);
  };

  useEffect(() => {
    const onFocus = () => setState(loadState() ?? {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const daily = state.daily ?? {};
  const items = state.items ?? {};
  const srs = state.srs ?? {};
  const stats = state.stats ?? { streak: 0, learnedCount: 0 };
  const sc = score(daily);

  const today = todayKey();
  const nowMs = Date.now();
  const snap = getTodaySnapshot(daily, stats, today);
  const heatmap = getHeatmapData(daily, new Date(), 365);
  const perTab = getPerTabBreakdown(daily);
  const accByLevel = getAccuracyByLevel(daily);
  const review = getReviewItems(items, 10);

  const showingLeagues = LEAGUES_ENABLED && activeView === VIEWS.leagues;
  const showingSettings = activeView === VIEWS.settings;

  const segmentBtn = (key, label, ariaLabel) => {
    const active = activeView === key;
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={active}
        onClick={() => setActiveView(key)}
        style={{
          ...NAV_BUTTON_BASE,
          background: active ? COLORS.ink : COLORS.card,
          color: active ? COLORS.paper : COLORS.ink,
          boxShadow: SHADOW.press(COLORS.lip),
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: SPACE[3], marginBottom: SPACE[4], flexWrap: 'wrap' }}>
        {segmentBtn(VIEWS.stats, 'STATS', 'stats')}
        {LEAGUES_ENABLED && segmentBtn(VIEWS.leagues, 'LEAGUES', 'leagues')}
        {segmentBtn(VIEWS.settings, 'SETTINGS', 'settings')}
      </div>

      {LEAGUES_ENABLED && selectedUser && (
        <ProfileCard
          userId={selectedUser}
          selfId={user?.id ?? null}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {showingSettings ? (
        settingsPanel
      ) : showingLeagues ? (
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
              <LevelCard lvl={sc} totalXp={sc.totalXp} learnedCount={stats.learnedCount ?? 0} />
              {!user && isAuthConfigured() && (
                <div style={{ marginTop: SPACE[5] }}>
                  <SectionLabel num="·" text="Account & sync" />
                  <Button onClick={onSignIn}>Sign in to sync →</Button>
                </div>
              )}
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
