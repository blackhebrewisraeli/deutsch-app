import { COLORS, FONTS, FONT_SIZE, SPACE, BUTTON, RADIUS } from '../../lib/theme';

/**
 * Free-text recall: type an answer, then CHECK. Used at B1, at A1/A2 when the
 * deck is too small to offer four distinct choices, and by the plural drill.
 *
 * `label` and `placeholder` default to the English-meaning wording, so the
 * original call sites read exactly as they did before this became reusable.
 *
 * @param {{ value: string, onChange: (v: string) => void, onSubmit: () => void,
 *           label?: string, placeholder?: string }} props
 */
export default function TypedAnswer({
  value,
  onChange,
  onSubmit,
  label = 'Type the English meaning',
  placeholder = 'Type the English meaning…',
}) {
  return (
    <div>
      <input
        aria-label={label}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: SPACE[4],
          border: 'none',
          borderRadius: RADIUS.md,
          boxShadow: 'inset 0 2px 5px rgba(22,17,11,0.06)',
          fontFamily: FONTS.display,
          fontSize: FONT_SIZE.xl,
          background: COLORS.card,
          marginBottom: SPACE[3],
          color: COLORS.ink,
        }}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!value.trim()}
        style={{
          ...BUTTON.go,
          width: '100%',
          opacity: value.trim() ? 1 : 0.4,
        }}
      >
        CHECK →
      </button>
    </div>
  );
}
