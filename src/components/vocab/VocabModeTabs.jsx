import { useRef, useState } from 'react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
  TRANSITION,
} from '../../lib/theme';
import { VOCAB_MODES, vocabTabId, vocabPanelId } from './vocabModes';
import { bp, useWindowWidth } from '../../lib/useWindowWidth';

const KEYS = VOCAB_MODES.map((m) => m.key);

/**
 * Inner Vocab modes. A real tablist — not SegmentedPicker — so arrows and a
 * single tab stop work. Manual selection: arrows move focus, Space/Enter/click
 * commit. Switching away from Practice mid-card is a session change; following
 * focus would commit that on the first arrow (same reason LevelSwitcher is
 * manual).
 */
export default function VocabModeTabs({
  active = 'practice',
  onPick,
  ariaLabel = 'Vocabulary mode',
}) {
  const refs = useRef({});
  const [focusedKey, setFocusedKey] = useState(null);
  const tiny = useWindowWidth() < bp.tiny;

  const current = KEYS.includes(active) ? active : 'practice';
  const rovingKey = focusedKey ?? current;
  const focusIndex = Math.max(0, KEYS.indexOf(rovingKey));

  const pick = (key) => {
    if (key !== current) onPick?.(key);
  };

  const onKeyDown = (e) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = null;
    if (delta) next = (focusIndex + delta + KEYS.length) % KEYS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = KEYS.length - 1;
    if (next === null) return;
    e.preventDefault();
    refs.current[KEYS[next]]?.focus();
  };

  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocusedKey(null);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${VOCAB_MODES.length}, minmax(0, 1fr))`,
        gap: tiny ? SPACE[2] : SPACE[3],
        marginTop: tiny ? SPACE[4] : SPACE[6],
      }}
    >
      {VOCAB_MODES.map((mode) => {
        const selected = mode.key === current;
        return (
          <button
            key={mode.key}
            type="button"
            role="tab"
            id={vocabTabId(mode.key)}
            aria-selected={selected}
            aria-controls={vocabPanelId(mode.key)}
            tabIndex={mode.key === KEYS[focusIndex] ? 0 : -1}
            ref={(el) => {
              refs.current[mode.key] = el;
            }}
            onFocus={() => setFocusedKey(mode.key)}
            onClick={() => pick(mode.key)}
            style={{
              border: 'none',
              borderRadius: RADIUS.md,
              boxShadow: SHADOW.press(selected ? COLORS.ink : COLORS.lip),
              background: selected ? COLORS.ink : COLORS.card,
              color: selected ? COLORS.paper : COLORS.ink,
              padding: tiny ? `${SPACE[3]}px ${SPACE[2]}px` : SPACE[4],
              cursor: 'pointer',
              fontFamily: FONTS.mono,
              fontWeight: FONT_WEIGHT.bold,
              letterSpacing: tiny ? LETTER_SPACING.wider : LETTER_SPACING.widest,
              // 12px everywhere: 10px is too small for primary navigation. Narrow
              // phones find the room in tracking and padding instead.
              fontSize: FONT_SIZE.sm,
              textTransform: 'uppercase',
              textAlign: 'center',
              transition: TRANSITION.fast,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
