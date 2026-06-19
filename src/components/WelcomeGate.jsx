import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING } from '../lib/theme';
import { isAuthConfigured } from '../lib/auth.js';
import Button from './ui/Button';

// First-visit screen. The guest path is always available (anonymous-first);
// the account actions render only when auth is configured, so no environment
// ever shows a dead button.
export default function WelcomeGate({ onGuest, onAuth }) {
  const authOn = isAuthConfigured();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.ink,
        color: COLORS.paper,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        fontFamily: FONTS.display,
        padding: 24,
      }}
    >
      <div
        style={{ fontSize: 64, fontWeight: FONT_WEIGHT.black, letterSpacing: LETTER_SPACING.tight }}
      >
        Deutsch<span style={{ color: COLORS.red }}>.</span>
      </div>
      <p
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          textTransform: 'uppercase',
          color: COLORS.mute,
        }}
      >
        Learn German with an AI tutor
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        {authOn && (
          <>
            <Button onClick={() => onAuth('create')}>Create account</Button>
            <Button variant="secondary" onClick={() => onAuth('signin')}>
              Sign in
            </Button>
          </>
        )}
        <button
          onClick={onGuest}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.paper,
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 8,
          }}
        >
          Continue without an account →
        </button>
      </div>
    </div>
  );
}
