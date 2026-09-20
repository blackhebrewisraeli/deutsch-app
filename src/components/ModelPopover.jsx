import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { BORDER, COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOW, SPACE } from '../lib/theme';
import { placeSheet, SHEET_GUTTER } from '../lib/sheetAnchor';
import { Meta, Body } from './ui/Text';
import { preferenceOption } from '../lib/ai-routing/preference.js';
import ModelPicker from './ModelPicker';

const SHEET_WIDTH = 288;
// The 2×2 picker plus its fallback caption, measured at 320px. Feeds the
// flip-above decision only; maxHeight caps what actually renders, so an
// underestimate scrolls rather than clipping.
const SHEET_HEIGHT = 240;
const SHEET = { width: SHEET_WIDTH, height: SHEET_HEIGHT };

/**
 * Chat's model control: one compact trigger that names the current preference
 * and opens the shared ModelPicker in a popover.
 *
 * Chat used to render the 2×2 grid inline — labelled in the wide aside, inside
 * a `<details>` when stacked — so four preference buttons sat permanently in
 * the tab order of a screen whose job is the conversation. Settings keeps the
 * always-visible grid, because that IS the settings surface; here the model is
 * a mode you switch occasionally, so it collapses to its current value.
 *
 * Non-modal, exactly like the three header sheets: `aria-haspopup="dialog"`,
 * no `aria-modal`, no scrim, and deliberately no focus trap — Tab is supposed
 * to leave a popover, and useFocusTrap.test.js guards that. Escape, an outside
 * click and a pick all dismiss; Escape and a pick hand focus back to the
 * trigger, so the keyboard position survives the round trip.
 *
 * Routing is untouched: this renders the same ModelPicker Settings renders and
 * reports the same preference ids upward. It owns no fallback rule of its own.
 */
export default function ModelPopover({ value, onChange, userTier = 'guest', label = 'Modell' }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: SHEET_GUTTER, width: SHEET_WIDTH });
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const option = preferenceOption(value);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // clientWidth, not innerWidth — innerWidth includes the scrollbar, which
    // would push the sheet a scrollbar's width off the trigger on desktop.
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    setAnchor(placeSheet(rect, { width, height }, SHEET));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const onPointer = (e) => {
      // No focus return on an outside click: the pointer has already landed
      // somewhere deliberate, and yanking focus back to the trigger fights it.
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', place);
    };
  }, [open, place, close]);

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        ref={buttonRef}
        // The visible text is "Modell" plus the current band, and the
        // accessible name contains both — WCAG 2.5.3 Label in Name, which an
        // aria-label of "Chat model" alone would break.
        aria-label={`${label}: ${option.label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-ui="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          maxWidth: '100%',
          minWidth: 0,
          background: COLORS.surface,
          color: COLORS.ink,
          border: BORDER.panel,
          borderRadius: RADIUS.md,
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          cursor: 'pointer',
        }}
      >
        <Meta>{label}</Meta>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.base,
            fontWeight: FONT_WEIGHT.semibold,
            color: COLORS.ink,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {option.label}
        </span>
        <ChevronDown size={14} aria-hidden="true" style={{ flexShrink: 0, color: COLORS.mute }} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          style={{
            // Viewport-anchored, not trigger-anchored — see placeSheet().
            position: 'fixed',
            top: anchor.top,
            left: anchor.left,
            width: anchor.width,
            maxHeight: `calc(100vh - ${SHEET_GUTTER * 2}px)`,
            overflowY: 'auto',
            background: COLORS.surfaceElevated,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.bar,
            padding: SPACE[4],
            zIndex: 60,
          }}
        >
          <Body size="sm" tone="soft" style={{ marginBottom: SPACE[3] }}>
            Auto keeps the router&apos;s pick. The other bands apply when your plan allows them.
          </Body>
          <ModelPicker
            value={value}
            onChange={(next) => {
              onChange?.(next);
              close();
            }}
            userTier={userTier}
            compact
          />
        </div>
      )}
    </div>
  );
}
