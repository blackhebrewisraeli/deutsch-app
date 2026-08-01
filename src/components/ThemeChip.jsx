import { useState, useEffect, useRef } from 'react';
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

// Header theme affordance — mode + tone in one compact sheet, reachable from
// every tab. Mirrors AccountChip's icon-button → sheet pattern so the header
// stays one control denser rather than five buttons inline.
export default function ThemeChip() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(() => getThemePreferenceForUI());
  const [tone, setTone] = useState(() => getThemeToneForUI());
  const rootRef = useRef(null);

  // Keep the picker in sync if the OS scheme changes under System.
  useEffect(() => watchSystemTheme(() => setMode(getThemePreferenceForUI())), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Appearance"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: COLORS.card,
          color: COLORS.ink,
          border: `1px solid ${COLORS.ink}`,
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
            position: 'absolute',
            right: 0,
            top: 40,
            background: COLORS.paper,
            border: `1px solid ${COLORS.ink}`,
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.bar,
            padding: SPACE[4],
            // Wide enough for the three mode pills; minmax tracks keep it from
            // forcing horizontal page overflow on a 320px viewport.
            width: 'min(280px, calc(100vw - 24px))',
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
