import SegmentedPicker from './ui/SegmentedPicker';

const OPTIONS = [
  { key: 'day', label: 'Day-light' },
  { key: 'night', label: 'Night-light' },
];

// Day-light / Night-light tone picker. Selecting calls onPick('day' | 'night').
// Spacing above it belongs to the caller, not here — see StatsTab.
export default function TonePicker({ tone, onPick }) {
  return (
    <SegmentedPicker
      options={OPTIONS}
      activeKey={tone}
      onPick={(o) => onPick(o.key)}
      ariaLabel="Tone"
    />
  );
}
