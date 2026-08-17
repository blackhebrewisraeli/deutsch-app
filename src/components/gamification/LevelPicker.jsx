import SegmentedPicker from '../ui/SegmentedPicker';

// Label/detail split mirrors GoalPicker: the word is the label, the short
// token is the big detail line.
const OPTIONS = [
  { key: 'a1', label: 'Beginner', detail: 'A1' },
  { key: 'a2', label: 'Elementary', detail: 'A2' },
  { key: 'b1', label: 'Intermediate', detail: 'B1' },
];

// Practice-level picker for the settings surface. Selecting calls onPick(key).
export default function LevelPicker({ level, onPick }) {
  return (
    <SegmentedPicker
      options={OPTIONS}
      activeKey={level}
      onPick={(o) => onPick(o.key)}
      ariaLabel="Practice level"
    />
  );
}
