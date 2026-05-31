// SplashScreen — shown once on first visit.
// Three-stripe German flag layout with level picker.
import { useState } from 'react';
import { FONT_DISPLAY, FONT_MONO } from '../lib/theme';

const S = {
  black: '#16110b',
  red:   '#D62828',
  gold:  '#F5C518',
  white: '#FFFFFF',
};

export default function SplashScreen({ onComplete }) {
  const [selected, setSelected]   = useState(null);
  const [fadingOut, setFadingOut] = useState(false);

  const handleSelect = (level) => {
    if (fadingOut) return;
    setSelected(level);
    setFadingOut(true);
    setTimeout(() => {
      localStorage.setItem('deutsch-onboarded', 'true');
      localStorage.setItem('deutsch-level', level);
      onComplete(level);
    }, 420);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      opacity: fadingOut ? 0 : 1,
      transition: 'opacity 0.42s ease-out',
    }}>

      {/* ── Stripe 1: Black — Logo ── */}
      <div style={{
        flex: 1.2,
        background: S.black,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}>
        <div style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 'clamp(52px, 10vw, 88px)',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: S.white,
          lineHeight: 1,
        }}>
          Deutsch<span style={{ color: S.red }}>.</span>
        </div>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.45em',
          color: `${S.white}55`,
          textTransform: 'uppercase',
        }}>
          Sprachschule
        </div>
      </div>

      {/* ── Stripe 2: Red — Level Picker ── */}
      <div style={{
        flex: 1,
        background: S.red,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
      }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.3em',
          color: `${S.white}CC`,
          textTransform: 'uppercase',
        }}>
          What&apos;s your level?
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { id: 'beginner',     label: '🌱 Beginner'     },
            { id: 'intermediate', label: '📚 Intermediate' },
          ].map(({ id, label }) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                style={{
                  padding: '12px 28px',
                  background:    isSelected ? S.white : 'transparent',
                  color:         isSelected ? S.red   : S.white,
                  border:        `2px solid ${isSelected ? S.white : 'rgba(255,255,255,0.45)'}`,
                  fontFamily:    FONT_MONO,
                  fontWeight:    700,
                  fontSize:      13,
                  letterSpacing: '0.08em',
                  cursor:        'pointer',
                  transform:     isSelected ? 'scale(0.97)' : 'scale(1)',
                  transition:    'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stripe 3: Gold — Tagline ── */}
      <div style={{
        flex: 0.65,
        background: S.gold,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.35em',
          color: `${S.black}99`,
          textTransform: 'uppercase',
        }}>
          Lernen · Sprechen · Verstehen
        </div>
      </div>

    </div>
  );
}
