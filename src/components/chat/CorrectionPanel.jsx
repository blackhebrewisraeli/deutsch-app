import { Volume2, Check } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY, RADIUS, SHADOW } from '../../lib/theme';
import { speak } from '../../lib/speech';
import { SectionLabel } from '../UI';

// Section B — grammar correction for the learner's last message, or an
// "Alles gut!" empty state when there's nothing to fix. Hidden on mobile when
// empty (the parent passes mobile so we can collapse it).
export default function CorrectionPanel({ correction, mobile }) {
  return (
    <aside style={{ display: mobile && !correction ? 'none' : 'block' }}>
      <SectionLabel num="B" text="Correction" />
      <div
        style={{
          borderRadius: RADIUS.lg,
          boxShadow: correction ? SHADOW.press(COLORS.rust) : SHADOW.card,
          background: correction ? COLORS.red : COLORS.card,
          color: correction ? COLORS.paper : COLORS.ink,
          minHeight: 240,
          padding: 20,
          transition: 'all 0.3s',
        }}
      >
        {correction ? (
          <div className="slide-up">
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.2em',
                opacity: 0.8,
                marginBottom: 16,
              }}
            >
              ⚠ NEEDS A FIX
            </div>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  opacity: 0.7,
                  marginBottom: 4,
                }}
              >
                YOU SAID
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 18,
                  textDecoration: 'line-through',
                  opacity: 0.85,
                }}
              >
                {correction.original}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '0.15em',
                  opacity: 0.7,
                  marginBottom: 4,
                }}
              >
                CORRECT
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600 }}>
                {correction.fixed}
              </div>
              <button
                type="button"
                onClick={() => speak(correction.fixed)}
                style={{
                  marginTop: 8,
                  background: 'transparent',
                  border: `1px solid ${COLORS.paper}`,
                  color: COLORS.paper,
                  padding: '4px 10px',
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Volume2 size={12} aria-hidden="true" /> HEAR IT
              </button>
            </div>
            <div
              style={{
                borderTop: `1px dashed ${COLORS.paperA80}`,
                paddingTop: 12,
                fontFamily: FONT_BODY,
                fontSize: 13,
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}
            >
              {correction.explain}
            </div>
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              minHeight: 200,
            }}
          >
            <Check size={32} style={{ color: COLORS.mute, marginBottom: 12 }} />
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 18,
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              Alles gut!
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: COLORS.mute,
              }}
            >
              No mistakes to fix
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
