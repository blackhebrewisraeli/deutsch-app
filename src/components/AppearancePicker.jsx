import SegmentedPicker from './ui/SegmentedPicker';

const OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

// Appearance mode picker. Selecting calls onPick('system' | 'light' | 'dark').
export default function AppearancePicker({ mode, onPick }) {
  return (
    <SegmentedPicker
      options={OPTIONS}
      activeKey={mode}
      onPick={(o) => onPick(o.key)}
      ariaLabel="Appearance"
    />
  );
}
