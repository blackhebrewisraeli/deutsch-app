import { Flame } from 'lucide-react';
import { SPACE } from '../lib/theme';
import { Hero, StatBlock } from './UI';
import LevelCard from './gamification/LevelCard';
import GoalRing from './gamification/GoalRing';

// Landing surface for every app open, guest or signed-in — a quick glance at
// standing progress. Deliberately NOT a second Stats tab: no accuracy
// breakdown, heatmap, leaderboard, or account section here. Those stay
// exclusive to Stats, which remains the deep dive. See
// docs/superpowers/specs/2026-08-24-entry-flow-and-home-dashboard-design.md §7.
export default function HomeTab({ lvl, totalXp, learnedCount, goalPct, goalMet, streak }) {
  return (
    <div>
      <Hero kicker="Section 01" title="Willkommen" sub="Your standing progress, at a glance." />
      <LevelCard lvl={lvl} totalXp={totalXp} learnedCount={learnedCount} />
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[5], marginTop: SPACE[6] }}>
        <GoalRing pct={goalPct} met={goalMet} size={72} />
        <StatBlock label="STREAK" value={streak} icon={<Flame size={16} />} accent />
      </div>
    </div>
  );
}
