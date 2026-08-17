import SegmentedPicker from '../ui/SegmentedPicker';

// CEFR codes only, no `detail` field. The descriptive word (Beginner /
// Elementary / Intermediate) doesn't fit: as a label it overflows the 56px
// box at 320/375px (single unbreakable word at LETTER_SPACING.widest), and as
// `detail` it overflows worse, since SegmentedPicker renders detail in the
// display face at FONT_SIZE.xl. The word lives in the caption below the
// picker instead (see StatsTab's LEVEL_NAMES lookup).
const OPTIONS = [
  { key: 'a1', label: 'A1' },
  { key: 'a2', label: 'A2' },
  { key: 'b1', label: 'B1' },
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
