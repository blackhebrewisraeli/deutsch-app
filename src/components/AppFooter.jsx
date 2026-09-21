import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE } from '../lib/theme';

/**
 * The page footer: strap line, compliance links, credit — one row.
 *
 * It owns the <footer> element, which is the app's single contentinfo
 * landmark. That ownership is the point of the component. While App.jsx held
 * the <footer> and this file held only the links, nothing owned the ROW: the
 * strap and credit were one flex line and the legal links were a second,
 * centered line underneath, so Privacy/Terms read as an afterthought bolted
 * under the footer rather than part of it.
 *
 * The strap is decoration and stays desktop-only. The legal links are NOT:
 * they render at every width. Hiding them on a phone — most of the audience —
 * would leave those users no route to the privacy policy at all, which is the
 * one thing these links exist to prevent. With the strap gone there is nothing
 * for `space-between` to push against, so the row centers on mobile instead of
 * jamming the links against the right edge.
 *
 * One tracking for the whole row (LETTER_SPACING.widest). The links used to
 * carry `caps` (0.2em) while the strap and credit carried `widest` (0.15em);
 * that difference was invisible while they sat on separate lines and reads as
 * a mistake once they are adjacent. The tighter of the two also buys room at
 * 320px.
 *
 * Real anchors with real hrefs, not buttons: they have to be copyable,
 * shareable and openable in a new tab. The click handler is a progressive
 * enhancement that keeps an ordinary left-click inside the SPA; a modified
 * click (new tab, new window) is left to the browser.
 *
 * Deliberately NOT a <nav> landmark. Two legal links are not a navigation
 * region, and adding a second landmark next to the app's real nav makes the
 * landmark list worse for a screen-reader user, not better. They live inside
 * the <footer>, which is already contentinfo.
 */
export default function AppFooter({ mobile = false, onNavigate }) {
  const handle = (event, to) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate?.(to);
  };

  // Hover as a JS handler rather than a stylesheet rule: the anchor sets
  // text-decoration inline, and an inline declaration outranks any rule in the
  // global sheet, so a :hover rule for it would be silently dropped.
  const hover = (on) => (event) => {
    event.currentTarget.style.textDecoration = on ? 'underline' : 'none';
  };

  const link = (label, to) => (
    <a
      href={to}
      data-ui="link"
      style={{ color: 'inherit', textDecoration: 'none' }}
      onClick={(e) => handle(e, to)}
      onMouseEnter={hover(true)}
      onMouseLeave={hover(false)}
    >
      {label}
    </a>
  );

  // Decoration, so aria-hidden: a screen reader should hear "Privacy", not
  // "Privacy middle dot".
  const dot = <span aria-hidden="true">·</span>;

  return (
    <footer
      style={{
        borderTop: `2px solid ${COLORS.ink}`,
        marginTop: SPACE[16],
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.widest,
        color: COLORS.mute,
        textTransform: 'uppercase',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: mobile ? 'center' : 'space-between',
          gap: SPACE[3],
          padding: `${SPACE[4]}px ${mobile ? SPACE[4] : SPACE[8]}px`,
          paddingBottom: `calc(${SPACE[4]}px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        {!mobile && <span>Lernen × Sprechen × Verstehen</span>}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACE[2],
          }}
        >
          {link('Privacy', '/privacy')}
          {dot}
          {link('Terms', '/terms')}
          {!mobile && (
            <>
              {dot}
              <span>{'// Powered by Claude'}</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
