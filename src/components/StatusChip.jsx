import { useState, useEffect, useRef, useCallback } from 'react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SHADOW,
  SPACE,
} from '../lib/theme';
import { writeLevel, LEVEL_NAMES, LEVEL_MODES } from '../lib/levelPref';
import { useSessionGuard } from '../lib/sessionGuard';
import LevelBadge from './gamification/LevelBadge';
import LevelSwitcher from './ui/LevelSwitcher';

const SHEET_WIDTH = 264;
const SHEET_GUTTER = 12;
// How far the CEFR pill sticks out past the badge disc. This is the entire
// width the code costs the header row.
const CODE_OVERHANG = 6;

// The header's single "my status" control: the XP badge and the CEFR practice
// level behind one trigger, opening one sheet.
//
// They are genuinely different things — one is earned, one is chosen — and an
// earlier pass gave them separate header chips for exactly that reason. That
// was the wrong trade. The masthead is the tightest row in the app (it already
// drops the wordmark below 360px after a 34px overflow at 320px, see App.jsx),
// and two adjacent controls both labelled "level" cost space AND make the
// reader disambiguate them. Sharing a trigger and separating them INSIDE the
// sheet, under their own headings, keeps the distinction without the clutter.
//
// The CEFR code stays on the face of the button rather than moving into the
// sheet: which level you are drilling is standing context, not something to
// go looking for. It rides the badge's bottom-right corner rather than
// sitting beside it, and that is a measurement, not a taste: at 320px with a
// populated account (level 42, 365-day streak, freeze chip, signed out) the
// header's control row already runs 290px inside a 300px content box. An
// inline code caption costs ~25px and overflowed the viewport by 4px; the
// corner pill costs the 6px it overhangs by.
export default function StatusChip({
  level,
  onLevelChange,
  xpLevel,
  progress,
  rank,
  xpIntoLevel,
  xpToNext,
  size = 52,
}) {
  const [open, setOpen] = useState(false);
  // The level the learner asked for while a practice session was live, held
  // until they confirm. Null the rest of the time.
  const [pending, setPending] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const sheetRef = useRef(null);
  const confirmRef = useRef(null);
  const guard = useSessionGuard();
  const [anchor, setAnchor] = useState({ top: 60, right: SHEET_GUTTER });

  // Viewport-clamped like ThemeChip's: this is not the rightmost header item,
  // so a plain `right: 0` sheet hangs off the left edge at 320px, and left
  // overflow never shows up in scrollWidth.
  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // clientWidth, not innerWidth — innerWidth includes the scrollbar.
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const width = Math.min(SHEET_WIDTH, vw - SHEET_GUTTER * 2);
    const maxRight = Math.max(SHEET_GUTTER, vw - width - SHEET_GUTTER);
    setAnchor({
      top: rect.bottom + 8,
      right: Math.min(Math.max(vw - rect.right, SHEET_GUTTER), maxRight),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPending(null);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setPending(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const commit = (next) => {
    writeLevel(next);
    onLevelChange?.(next);
    setPending(null);
    setOpen(false);
    buttonRef.current?.focus();
  };

  // Switching restarts whatever the current tab has in flight. Ask first, but
  // only when there is genuinely something to lose — a confirmation that fires
  // every time trains people to dismiss it. The control is never disabled:
  // a dead control with no explanation is worse than a question.
  const handleChange = (next) => {
    const session = guard?.activeSession();
    if (session) setPending({ level: next, session });
    else commit(next);
  };

  // Focus has to move with the sheet's body, or a keyboard user is left on a
  // control that just unmounted. Both directions run from an effect: the
  // target of each only exists AFTER the re-render that swaps the body, so
  // focusing inline from the click handler silently does nothing.
  const restoreFocusRef = useRef(false);
  useEffect(() => {
    if (pending) {
      confirmRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      sheetRef.current?.querySelector('[role="radio"][aria-checked="true"]')?.focus();
    }
  }, [pending]);

  const cancelPending = () => {
    // Back to the choice they were making, not out of the sheet entirely.
    restoreFocusRef.current = true;
    setPending(null);
  };

  const caption = (text) => (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.wider,
        textTransform: 'uppercase',
        color: COLORS.mute,
        marginBottom: SPACE[2],
      }}
    >
      {text}
    </div>
  );

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        // Both signals named, in the order the sheet presents them. The badge
        // previously carried this only as a `title`, which is not an
        // accessible name — consolidating fixes that on the way past.
        aria-label={`XP level ${xpLevel}, ${rank}. Practice level ${level.toUpperCase()}. Open status`}
        aria-haspopup="dialog"
        aria-expanded={open}
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          display: 'block',
          background: 'transparent',
          border: 'none',
          padding: 0,
          // Only the pill's overhang is added to the badge's own footprint.
          marginRight: CODE_OVERHANG,
          cursor: 'pointer',
          flexShrink: 0,
          color: 'inherit',
          lineHeight: 0,
        }}
      >
        <LevelBadge level={xpLevel} progress={progress} rank={rank} size={size} />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -CODE_OVERHANG,
            bottom: 0,
            // Its own surface, for the same reason the badge disc has one:
            // the masthead holds its charcoal in both themes, so on-charcoal
            // ink is the only pairing that stays legible there, and this pill
            // instead reuses the audited surface/ink pairing.
            background: COLORS.surface,
            color: COLORS.ink,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.pill,
            padding: '0 4px',
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: LETTER_SPACING.wide,
            lineHeight: '14px',
          }}
        >
          {level.toUpperCase()}
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Status"
          ref={sheetRef}
          style={{
            // Viewport-anchored, not button-anchored — see `place()` above.
            position: 'fixed',
            top: anchor.top,
            right: anchor.right,
            background: COLORS.surfaceElevated,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.bar,
            padding: SPACE[4],
            width: `min(${SHEET_WIDTH}px, calc(100vw - ${SHEET_GUTTER * 2}px))`,
            zIndex: 60,
          }}
        >
          {pending ? (
            <>
              {caption('Switch level?')}
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.sm,
                  color: COLORS.ink,
                  lineHeight: 1.5,
                  overflowWrap: 'anywhere',
                }}
              >
                {`Moving to ${pending.level.toUpperCase()} restarts your current set — you are on ${pending.session}.`}
              </div>
              <div style={{ display: 'flex', gap: SPACE[2], marginTop: SPACE[4] }}>
                <button
                  type="button"
                  ref={confirmRef}
                  onClick={() => commit(pending.level)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    borderRadius: RADIUS.md,
                    boxShadow: SHADOW.press(COLORS.greenDeep),
                    background: COLORS.green,
                    color: COLORS.paper,
                    padding: SPACE[3],
                    cursor: 'pointer',
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    fontWeight: FONT_WEIGHT.bold,
                    letterSpacing: LETTER_SPACING.wider,
                    textTransform: 'uppercase',
                  }}
                >
                  {`Switch to ${pending.level.toUpperCase()}`}
                </button>
                <button
                  type="button"
                  onClick={cancelPending}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    borderRadius: RADIUS.md,
                    boxShadow: SHADOW.press(COLORS.lip),
                    background: COLORS.card,
                    color: COLORS.ink,
                    padding: SPACE[3],
                    cursor: 'pointer',
                    fontFamily: FONTS.mono,
                    fontSize: FONT_SIZE.tag,
                    fontWeight: FONT_WEIGHT.bold,
                    letterSpacing: LETTER_SPACING.wider,
                    textTransform: 'uppercase',
                  }}
                >
                  Keep going
                </button>
              </div>
            </>
          ) : (
            <>
              {caption('Progress')}
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.sm,
                  fontWeight: FONT_WEIGHT.bold,
                  color: COLORS.ink,
                  overflowWrap: 'anywhere',
                }}
              >
                {`Level ${xpLevel} · ${rank}`}
              </div>
              {/* Same track/green pairing the badge ring uses, so the bar and the
              ring above it read as one measurement rather than two. */}
              <div
                style={{
                  height: 4,
                  background: COLORS.track,
                  borderRadius: RADIUS.pill,
                  margin: `${SPACE[2]}px 0`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`,
                    background: COLORS.green,
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  letterSpacing: LETTER_SPACING.wide,
                  color: COLORS.mute,
                }}
              >
                {`${xpIntoLevel} / ${xpToNext} XP to level ${xpLevel + 1}`}
              </div>

              <div
                style={{
                  height: 1,
                  background: COLORS.border,
                  margin: `${SPACE[4]}px 0`,
                }}
              />

              {caption('Practice level')}
              <LevelSwitcher value={level} onChange={handleChange} variant="compact" />
              <div
                style={{
                  marginTop: SPACE[3],
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  letterSpacing: LETTER_SPACING.wide,
                  color: COLORS.mute,
                  overflowWrap: 'anywhere',
                }}
              >
                {LEVEL_NAMES[level] ?? ''}
                {LEVEL_MODES[level] ? ` · ${LEVEL_MODES[level].label}` : ''}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
