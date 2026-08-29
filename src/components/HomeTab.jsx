import { Flame } from 'lucide-react';
import { SPACE } from '../lib/theme';
import { Hero, StatBlock } from './UI';
import LevelCard from './gamification/LevelCard';
import GoalRing from './gamification/GoalRing';
import IdentityStrip from './IdentityStrip';
import MissionBoard from './MissionBoard';
import ErrorBoundary from './ErrorBoundary';

// Landing surface for every app open, guest or signed-in — a quick glance at
// standing progress, who you are, and what is open.
//
// Deliberately NOT a second Stats tab: no accuracy breakdown, heatmap,
// leaderboard, or account MANAGEMENT here. Those stay exclusive to Stats and
// Settings. See docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md §7
// for the original exclusion (E5), and the 2026-08-29 design §4.1 for the
// identity strip that narrows it — identity, not administration.
export default function HomeTab({
  lvl,
  totalXp,
  learnedCount,
  goalPct,
  goalMet,
  streak,
  user = null,
  profile = null,
  cefrLevel,
  missions = [],
  onGoToTab,
  onOpenSettings,
}) {
  return (
    <div>
      <Hero kicker="Section 01" title="Willkommen" sub="Your standing progress, at a glance." />

      <div style={{ marginTop: SPACE[6] }}>
        <IdentityStrip
          user={user}
          profile={profile}
          lvl={cefrLevel}
          onOpenSettings={onOpenSettings}
        />
      </div>

      <div style={{ marginTop: SPACE[8] }}>
        <LevelCard lvl={lvl} totalXp={totalXp} learnedCount={learnedCount} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[5], marginTop: SPACE[6] }}>
        <GoalRing pct={goalPct} met={goalMet} size={72} />
        <StatBlock label="STREAK" value={streak} icon={<Flame size={16} />} accent />
      </div>

      {/* Home is the default tab, so a throw while deriving missions would be a
          crash on app open. Contained here, the rest of the glance survives. */}
      <div style={{ marginTop: SPACE[8] }}>
        <ErrorBoundary>
          <MissionBoard missions={missions} onGo={onGoToTab} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
