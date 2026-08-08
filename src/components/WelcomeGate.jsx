import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING } from '../lib/theme';
import { isAuthConfigured } from '../lib/auth.js';
import Button from './ui/Button';
import GoogleButton from './auth/GoogleButton';

// First-visit screen. The guest path is always available (anonymous-first);
// the account actions render only when auth is configured, so no environment
// ever shows a dead button. GoogleButton self-guards on its own flag, so it
// simply is not there until an owner turns Google on.
export default function WelcomeGate({ onGuest, onAuth, onGoogle, googleBusy = false }) {
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
      {/* Inline styles can't express :focus-visible; a scoped rule gives the
          bare guest button a visible focus ring on the dark background. */}
      <style>{`.welcome-guest:focus-visible { outline: 2px solid ${COLORS.paper}; outline-offset: 2px; border-radius: 4px; }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        {authOn && (
          <>
            <GoogleButton onClick={onGoogle} busy={googleBusy} />
            <Button onClick={() => onAuth('create')}>Create account</Button>
            <Button variant="secondary" onClick={() => onAuth('signin')}>
              Sign in
            </Button>
          </>
        )}
        <button
          className="welcome-guest"
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
          Try it first — free →
        </button>
      </div>
    </div>
  );
}
