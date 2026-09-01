import { Flame } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { StatBlock } from './UI';
import GoalRing from './gamification/GoalRing';
import PersonalHub from './PersonalHub';
import RecommendedActions from './RecommendedActions';
import { resolveRecommended } from './resolveRecommended';
import MissionBoard from './MissionBoard';
import QuestBoard from './QuestBoard';
import ErrorBoundary from './ErrorBoundary';
import { activePack } from '../packs';

// Landing surface for every app open, guest or signed-in — who you are, what
// to do next, and what is still open today.
//
// Deliberately NOT a second Stats tab and NOT a Settings page: no accuracy
// breakdown, heatmap, leaderboard, or account MANAGEMENT here. Those stay
// exclusive to the Profile tab. See
// docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md §7
// for the original exclusion (E5), and the 2026-08-29 design §4.1 for the
// identity that narrows it — identity, not administration.
export default function HomeTab({
  score,
  learnedCount,
  goalPct,
  goalMet,
  streak,
  user = null,
  profile = null,
  cefrLevel,
  missions = [],
  quests = [],
  onGoToTab,
  onOpenSettings,
}) {
  const chrome = activePack.content.homeChrome ?? {};
  const { remaining } = resolveRecommended(missions);

  return (
    <div>
      <PersonalHub
        user={user}
        profile={profile}
        cefrLevel={cefrLevel}
        score={score}
        learnedCount={learnedCount}
        onOpenSettings={onOpenSettings}
      />

      <div style={{ marginTop: SPACE[6] }}>
        <ErrorBoundary>
          <RecommendedActions missions={missions} onGo={onGoToTab} />
        </ErrorBoundary>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[5], marginTop: SPACE[6] }}>
        <GoalRing pct={goalPct} met={goalMet} size={72} />
        <StatBlock label="STREAK" value={streak} icon={<Flame size={16} />} accent />
      </div>

      {/* Remaining Missionen and Tagesaufgaben share a day-scoped heading, but
          keep their own labelled regions — a screen reader that jumps by
          heading still finds each board, and the tests that pin those names
          would otherwise go blind. */}
      <section aria-labelledby="heute-heading" style={{ marginTop: SPACE[8] }}>
        <div
          id="heute-heading"
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: LETTER_SPACING.caps,
            textTransform: 'uppercase',
            color: COLORS.mute,
          }}
        >
          {chrome.todayHeading}
        </div>
        {chrome.todaySub && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: FONT_SIZE.base,
              color: COLORS.inkSoft,
              marginTop: SPACE[1],
            }}
          >
            {chrome.todaySub}
          </div>
        )}
        <div
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            marginTop: SPACE[4],
            paddingTop: SPACE[5],
          }}
        />

        <ErrorBoundary>
          <MissionBoard missions={remaining} onGo={onGoToTab} />
        </ErrorBoundary>

        <div style={{ marginTop: SPACE[8] }}>
          <ErrorBoundary>
            <QuestBoard quests={quests} onGo={onGoToTab} />
          </ErrorBoundary>
        </div>
      </section>
    </div>
  );
}
