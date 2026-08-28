import { SPACE } from '../../lib/theme';

// Four layout primitives in one file. Each is a few lines of flex/grid config
// over the same SPACE scale; four files would be four import lines for one idea,
// and a caller looking for Stack finds it here on the first grep.
//
// Their purpose is not brevity. It is to make four failure modes
// unrepresentable, each of which has already cost this project a bug:
//   - a bare `1fr` track that refuses to shrink        (Grid)
//   - a non-wrapping row at 320px                      (Row)
//   - a flex child that cannot shrink below its text   (minWidth: 0)
//   - a per-tab re-derivation of the page measure      (PageFrame)

// ── minWidth: 0 — necessary, and NOT sufficient ──────────────────────────────
//
// A flex child needs `minWidth: 0` for text to shrink below its intrinsic width.
// But on its own it does not fix overflow — it HIDES it: the overflow stops
// widening the container and renders as text drawn on top of text instead.
// scrollWidth never exceeds clientWidth, so no overflow assertion can catch it.
// The layout is broken and every width test passes.
//
// So: a flex child holding variable-length text sets minWidth: 0 AND declares
// what happens when it does not fit — it wraps (Row's default), it truncates
// (overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap), or it scrolls
// in its own container. minWidth: 0 with no stated overflow behaviour is an
// incomplete style, and reviewers should treat it as one.
//
// Row and Stack apply it to themselves. They cannot apply it to children they do
// not own, and the truncation decision belongs to the caller anyway — it is a
// content decision, not a layout one.
const SHRINKABLE = { minWidth: 0 };

export function Stack({ gap = 4, align, as: Tag = 'div', style, children, ...rest }) {
  return (
    <Tag
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[gap] ?? SPACE[4],
        alignItems: align,
        ...SHRINKABLE,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Row({
  gap = 3,
  align = 'center',
  justify,
  // Wrapping is the default: at 320px a non-wrapping row is the most common
  // overflow source in this app. A caller who genuinely must not wrap passes
  // wrap={false} and thereby writes down that they accepted the risk.
  wrap = true,
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  return (
    <Tag
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: SPACE[gap] ?? SPACE[3],
        ...SHRINKABLE,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Grid({
  columns = 2,
  min = 120,
  gap = 3,
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  // ALWAYS minmax(0, 1fr). A bare 1fr keeps min-width:auto, so the track refuses
  // to shrink below its content and pushes the page wider than the viewport.
  // Four separate mobile-overflow bugs came from this (docs/DEMO_READINESS.md
  // #15-#17), which is why it is structural here rather than remembered.
  const tracks =
    columns === 'auto-fit'
      ? `repeat(auto-fit, minmax(${min}px, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`;

  return (
    <Tag
      style={{
        display: 'grid',
        gridTemplateColumns: tracks,
        gap: SPACE[gap] ?? SPACE[3],
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// The outermost per-tab wrapper. Not a Stack with different defaults: it is the
// one place the max measure and the page gutters are decided, and today both
// are re-derived per tab.
//
// There is deliberately NO safe-area inset here. This app does not opt into safe
// areas: index.html's viewport meta is `width=device-width, initial-scale=1.0`
// with no `viewport-fit=cover`, and without that opt-in iOS reports every
// env(safe-area-inset-*) as 0 — in Mobile Safari and inside the installed PWA
// alike (vite.config.js sets display:'standalone'). A paddingBottom of
// env(safe-area-inset-bottom, 0px) used to sit here; it always resolved to 0, so
// it was inert rather than protective while reading as load-bearing.
//
// Opting in is a real visual change, not a one-attribute fix: the masthead in
// App.jsx is `position: sticky; top: 0`, so with viewport-fit=cover it would
// slide under the status bar / Dynamic Island unless it takes an inset-top, and
// the inline gutters below would need inset-left/right or landscape content goes
// under the notch. That work needs a notched device to verify and is not done.
// src/safeArea.test.js fails if either half of the opt-in lands without the other.
export function PageFrame({
  maxWidth = 900,
  gutter = 4,
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  return (
    <Tag
      style={{
        maxWidth,
        marginInline: 'auto',
        paddingInline: SPACE[gutter] ?? SPACE[4],
        width: '100%',
        ...SHRINKABLE,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
