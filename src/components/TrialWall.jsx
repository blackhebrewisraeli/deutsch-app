import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, RADIUS, SHADOW, SPACE } from '../lib/theme';
import Button from './ui/Button';

// The mono caption treatment used twice below — small uppercase mute label,
// the same voice as WelcomeGate's tagline.
const caption = {
  margin: 0,
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  letterSpacing: LETTER_SPACING.caps,
  textTransform: 'uppercase',
  color: COLORS.mute,
};

/**
 * The guest-trial wall: a blocking sheet over the practice surface once the
 * trial is exhausted. Presentational only — props in, callbacks out. App.jsx
 * decides when it renders (auth configured, anonymous, exhausted, on a
 * practice tab, no celebration running).
 *
 * Deliberately NOT dismissible: no close button, no backdrop click, and no
 * Escape handler. The escape hatch is the Stats tab, which stays reachable
 * because this scrim covers the practice surface only.
 *
 * No `aria-modal` either — the header and nav stay operable by design, so
 * claiming a modal would lie to assistive tech about what is reachable.
 */
export default function TrialWall({ roundsUsed = 0, mobile = false, onCreateAccount, onSignIn }) {
  // Clearance under App's sticky header + nav, which stack to ~113px on mobile
  // and ~132px on desktop. This is a gap, not an alignment, so it only has to
  // be about right — the card must simply never dock underneath the nav.
  const stickyTop = mobile ? 121 : 140;

  return (
    <div
      role="dialog"
      aria-label="Save your progress"
      style={{
        position: 'absolute',
        inset: 0,
        // BELOW App's nav (49) and header (50) on purpose. The practice
        // surface is the only thing this may cover; once the page scrolls, a
        // higher z-index paints the scrim straight over the sticky chrome and
        // takes the Stats tab — the wall's own escape hatch — with it.
        zIndex: 40,
        display: 'flex',
        // Top-aligned, not centred: the practice surface runs well past the
        // fold, and a centred card lands below it on a phone.
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: COLORS.inkAa,
        padding: SPACE[6],
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          // Sticky so the wall stays with the user down a long practice
          // surface instead of scrolling away from the scrim it belongs to.
          position: 'sticky',
          top: stickyTop,
          maxHeight: `calc(100vh - ${stickyTop + SPACE[6]}px)`,
          overflowY: 'auto',
          background: COLORS.paper,
          color: COLORS.ink,
          borderRadius: RADIUS.xl,
          padding: SPACE[6],
          maxWidth: 400,
          width: '100%',
          minWidth: 0,
          boxShadow: SHADOW.bar,
          boxSizing: 'border-box',
          fontFamily: FONTS.body,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[3],
        }}
      >
        <p style={caption}>
          {roundsUsed} {roundsUsed === 1 ? 'round' : 'rounds'} practised
        </p>

        <h2 style={{ margin: 0, fontFamily: FONTS.display, fontSize: FONT_SIZE['3xl'] }}>
          Save your progress
        </h2>

        <p style={{ margin: 0, fontSize: FONT_SIZE.md }}>
          Create a free account to keep going — every round you've practised comes with you.
        </p>

        {/* autoFocus rides Button's ...rest through to the <button>: focus has
            to follow the wall, which interrupts the practice flow. */}
        <Button autoFocus onClick={onCreateAccount}>
          Create a free account
        </Button>
        <Button variant="secondary" onClick={onSignIn}>
          I already have an account
        </Button>

        <p style={caption}>Your stats stay open — tap Stats below.</p>
      </div>
    </div>
  );
}
