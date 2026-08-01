import { GOAL_PRESETS } from '../../lib/gamification';
import SegmentedPicker from '../ui/SegmentedPicker';

const OPTIONS = [
  { key: 'casual', label: 'Casual', xp: GOAL_PRESETS.casual },
  { key: 'regular', label: 'Regular', xp: GOAL_PRESETS.regular },
  { key: 'serious', label: 'Serious', xp: GOAL_PRESETS.serious },
];

// Daily-goal preset picker. Selecting calls onPick(xpValue).
export default function GoalPicker({ goal, onPick }) {
  const active = OPTIONS.find((o) => o.xp === goal);
  return (
    <SegmentedPicker
      options={OPTIONS.map((o) => ({ ...o, detail: `${o.xp} XP` }))}
      activeKey={active?.key}
      onPick={(o) => onPick(o.xp)}
      ariaLabel="Daily goal"
    />
  );
}
