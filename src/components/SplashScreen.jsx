import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SHADOW,
} from '../lib/theme';
import { stampSettings } from '../lib/settingsStamp';

export default function SplashScreen({ onComplete }) {
  const handleSelect = (level) => {
    localStorage.setItem('deutsch-level', level);
    stampSettings();
    localStorage.setItem('deutsch-onboarded', '1');
    onComplete(level);
  };

  const btnStyle = {
    padding: '16px 28px',
    background: COLORS.paper,
    color: COLORS.ink,
    border: 'none',
    borderRadius: RADIUS.lg,
    boxShadow: SHADOW.press(COLORS.rust),
    fontFamily: FONTS.mono,
    fontWeight: FONT_WEIGHT.bold,
    fontSize: FONT_SIZE.lg,
    letterSpacing: LETTER_SPACING.wider,
    cursor: 'pointer',
    transition: 'transform .08s ease, box-shadow .08s ease',
    minWidth: 200,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONTS.display,
      }}
    >
      {/* Black stripe */}
      <div
        style={{
          flex: 1,
          background: COLORS.ink,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: FONT_WEIGHT.black,
            color: COLORS.paper,
            letterSpacing: LETTER_SPACING.tight,
            lineHeight: 1,
          }}
        >
          Deutsch<span style={{ color: COLORS.red }}>.</span>
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
            marginTop: 12,
            textTransform: 'uppercase',
          }}
        >
          Sprachschule
        </div>
      </div>

      {/* Red stripe — level picker */}
      <div
        style={{
          flex: 1,
          background: COLORS.red,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          padding: '0 24px',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.paper,
            textTransform: 'uppercase',
          }}
        >
          What&apos;s your level?
        </div>
        <div
          className="pop"
          style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <button onClick={() => handleSelect('a1')} style={btnStyle}>
            🌱 Beginner (A1)
          </button>
          <button onClick={() => handleSelect('a2')} style={btnStyle}>
            📚 Elementary (A2)
          </button>
          <button onClick={() => handleSelect('b1')} style={btnStyle}>
            🎓 Intermediate (B1)
          </button>
        </div>
      </div>

      {/* Gold stripe */}
      <div
        style={{
          flex: 1,
          background: COLORS.gold,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.accentOn,
            textTransform: 'uppercase',
          }}
        >
          Lernen · Sprechen · Verstehen
        </div>
      </div>
    </div>
  );
}
