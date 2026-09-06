import { COLORS, FONTS, FONT_SIZE, SPACE, BUTTON, RADIUS, SHADOW } from '../../lib/theme';

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
      }}
    >
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
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          boxShadow: SHADOW.inset,
          fontFamily: FONTS.display,
          fontSize: FONT_SIZE.xl,
          background: COLORS.surface,
          marginBottom: SPACE[3],
          color: COLORS.ink,
          // Left-aligned on purpose. A centered field looks tidy for "bread"
          // and hides the start of a long gloss behind scrollWidth > clientWidth.
          textAlign: 'start',
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
