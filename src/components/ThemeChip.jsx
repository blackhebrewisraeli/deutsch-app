import { useState, useEffect, useRef, useCallback } from 'react';
import { Sun } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACE } from '../lib/theme';
import {
  getThemePreferenceForUI,
  setThemePreference,
  getThemeToneForUI,
  setThemeTone,
  watchSystemTheme,
} from '../lib/themeMode';
import AppearancePicker from './AppearancePicker';
import TonePicker from './TonePicker';

const SHEET_WIDTH = 280;
const SHEET_GUTTER = 12;

// Header theme affordance — mode + tone in one compact sheet, reachable from
// every tab. Mirrors AccountChip's icon-button → sheet pattern so the header
// stays one control denser rather than five buttons inline.
export default function ThemeChip() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(() => getThemePreferenceForUI());
  const [tone, setTone] = useState(() => getThemeToneForUI());
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const [anchor, setAnchor] = useState({ top: 60, right: SHEET_GUTTER });

  // Keep the picker in sync if the OS scheme changes under System.
  useEffect(() => watchSystemTheme(() => setMode(getThemePreferenceForUI())), []);

  // The chip is not the rightmost header item — AccountChip sits to its right —
  // so a plain `right: 0` sheet hangs off the *left* edge of a 320px viewport
  // (measured: left -65.7px, with "Mode"/"Tone" and the SYSTEM/DAY-LIGHT pills
  // cut off). Left overflow never shows up in scrollWidth, so no overflow
  // assertion catches it. Anchor to the chip where there is room, clamp to the
  // viewport where there is not.
  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // clientWidth, not innerWidth — innerWidth includes the scrollbar, which
    // would push the sheet a scrollbar's width off the chip on desktop.
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
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e) => {
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
  }, [open, place]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: COLORS.surface,
          color: COLORS.ink,
          border: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <Sun size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Appearance"
          style={{
            // Viewport-anchored, not chip-anchored — see `place()` above.
            position: 'fixed',
            top: anchor.top,
            right: anchor.right,
            background: COLORS.surfaceElevated,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.bar,
            padding: SPACE[4],
            // Wide enough for the three mode pills, never wider than the viewport.
            width: `min(${SHEET_WIDTH}px, calc(100vw - ${SHEET_GUTTER * 2}px))`,
            zIndex: 60,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: COLORS.mute,
              marginBottom: SPACE[3],
            }}
          >
            Mode
          </div>
          <AppearancePicker
            mode={mode}
            onPick={(pref) => {
              setThemePreference(pref);
              setMode(pref);
            }}
          />
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: COLORS.mute,
              marginTop: SPACE[4],
              marginBottom: SPACE[3],
            }}
          >
            Tone
          </div>
          <TonePicker
            tone={tone}
            onPick={(next) => {
              setThemeTone(next);
              setTone(next);
            }}
          />
        </div>
      )}
    </div>
  );
}
