import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE } from '../../lib/theme';

/**
 * The compliance links.
 *
 * Rendered at EVERY width, unlike the decorative footer above it, which is
 * desktop-only. Hiding these on mobile would leave a phone user — most of the
 * audience — with no route to the privacy policy at all, which is the one
 * thing these links exist to prevent.
 *
 * Real anchors with real hrefs, not buttons: they have to be copyable,
 * shareable and openable in a new tab. The click handler is a progressive
 * enhancement that keeps an ordinary left-click inside the SPA; a modified
 * click (new tab, new window) is left to the browser.
 *
 * Deliberately NOT a <nav> landmark. Two legal links are not a navigation
 * region, and adding a second landmark next to the app's real nav makes the
 * landmark list worse for a screen-reader user, not better. It lives inside
 * the existing <footer>, which is already the contentinfo landmark.
 */
export default function LegalFooter({ onNavigate }) {
  const handle = (event, to) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate?.(to);
  };

  const linkStyle = {
    color: COLORS.mute,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.tag,
    letterSpacing: LETTER_SPACING.caps,
    textTransform: 'uppercase',
    textDecoration: 'none',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: SPACE[4],
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        paddingBottom: `calc(${SPACE[3]}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <a href="/privacy" style={linkStyle} onClick={(e) => handle(e, '/privacy')}>
        Privacy
      </a>
      <a href="/terms" style={linkStyle} onClick={(e) => handle(e, '/terms')}>
        Terms
      </a>
    </div>
  );
}
