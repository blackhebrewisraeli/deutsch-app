import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { isAuthConfigured } from '../lib/auth.js';
import Button from './ui/Button';
import GoogleButton from './auth/GoogleButton';

/** Minimum comfortable touch target, px — the iOS Human Interface guideline. */
const TAP_TARGET_MIN = 44;

// Entry screen. The guest path is always available (anonymous-first);
// the account actions render only when auth is configured, so no environment
// ever shows a dead button. GoogleButton self-guards on its own flag, so it
// simply is not there until an owner turns Google on.
export default function WelcomeGate({ onGuest, onAuth, onGoogle, googleBusy = false }) {
  const authOn = isAuthConfigured();
  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.paper,
        color: COLORS.ink,
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
          bare guest button a visible focus ring against the ground colour. */}
      <style>{`.welcome-guest:focus-visible { outline: 2px solid ${COLORS.ink}; outline-offset: 2px; border-radius: 4px; }`}</style>
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
            color: COLORS.ink,
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: SPACE[2],
            // Styled as a text link, but it is the front door to the whole
            // guest trial and the only way past this screen without an
            // account — and since the gate stopped being a once-per-device
            // event, every guest meets it on every visit. Padding alone left
            // it 29px tall on a phone, under the 44px minimum, and the
            // smallest target on the screen was the one most people reach for.
            // The underline still reads as a link; only the hit area grows.
            minHeight: TAP_TARGET_MIN,
          }}
        >
          Try it first — free →
        </button>
      </div>
    </div>
  );
}
