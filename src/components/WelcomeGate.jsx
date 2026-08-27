import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../lib/theme';
import { isAuthConfigured } from '../lib/auth.js';
import Button from './ui/Button';
import GoogleButton from './auth/GoogleButton';
import ThemeChip from './ThemeChip';

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
      className="entry-screen"
      style={{
        position: 'relative',
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
      {/* Theme access from the very first frame. This is the only screen that
          renders before the main app's own header (which already has
          ThemeChip) once the level-picker splash is gone, so it gets its own
          corner rather than a shared shell. */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeChip />
      </div>
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
            <GoogleButton onClick={onGoogle} busy={googleBusy} />
            <Button onClick={() => onAuth('create')}>Create account</Button>
            <Button variant="secondary" onClick={() => onAuth('signin')}>
              Sign in
            </Button>
          </>
        )}
        <button
          // Opts into the app's one focus ring, defined in injectGlobalStyles.
          data-ui="button"
          onClick={onGuest}
          style={{
            background: 'none',
            border: 'none',
            // The ring follows the element's own radius, so the radius the
            // deleted scoped rule used to set has to live here instead.
            borderRadius: SPACE[1],
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
