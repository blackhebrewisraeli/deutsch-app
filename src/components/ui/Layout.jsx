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
  //
  // String(columns), not a bare `columns === 'auto-fit'`. `columns` is a union —
  // a track count, or the string 'auto-fit' — but its default is the number 2,
  // and Sonar infers the parameter's type from that default alone. It therefore
  // reads the bare strict-equality as number === string, concludes it can never
  // be true, and raises S3403 "Remove this '===' check; it will always be false"
  // as a Major bug. That is a false positive — the branch is reachable and
  // covered (see 'emits minmax on the auto-fit path too' in Layout.test.jsx) —
  // but it turned the whole main-branch quality gate red at PR #172 and kept it
  // red for every merge after, because SonarCloud was not yet a required check.
  //
  // Coercing makes both operands strings, so the comparison is unambiguous to
  // the analyser and identical at runtime: String(2) is '2', which is not
  // 'auto-fit'. Do not "simplify" this back.
  const autoFit = String(columns) === 'auto-fit';
  const tracks = autoFit
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

// The outermost per-tab wrapper, and the one place the measure and the gutters
// are decided.
//
// The defaults describe THIS APP's shell rather than a general recommendation:
// 1400 is App.jsx's <main> measure, and 900 (the value shipped in sub-project
// 1b, written with no consumer to check it against) would cut Chat's
// conversation column from 688px to 188px.
//
// `gutter` drives the inline edges AND the top because in this app they are the
// same number — 16 on mobile, 32 on desktop. Bottom is its own prop because it
// is the only edge that does not vary with viewport.
//
// No useWindowWidth in here. A layout primitive that reads the viewport has a
// hidden dependency and cannot be tested without stubbing the hook; the caller
// already knows whether it is mobile.
//
// Safe-area insets are ADDED to the gutters, never substituted for them —
// that composition is what `bottomGutter` exists to guarantee (spec §3.4).
// The viewport opt-in lives in index.html (`viewport-fit=cover`); without it
// these env() terms resolve to 0. The sticky masthead in App.jsx owns
// inset-top so the charcoal bar paints under the status bar; this primitive
// owns the inline edges (landscape notch) and the bottom (home indicator).
// src/safeArea.test.js fails if either half of the opt-in lands without the other.
export function PageFrame({
  maxWidth = 1400,
  gutter = 4,
  bottomGutter = 8,
  as: Tag = 'div',
  style,
  children,
  ...rest
}) {
  const inline = SPACE[gutter] ?? SPACE[4];
  const bottom = SPACE[bottomGutter] ?? SPACE[8];
  return (
    <Tag
      style={{
        maxWidth,
        marginInline: 'auto',
        paddingLeft: `calc(${inline}px + env(safe-area-inset-left, 0px))`,
        paddingRight: `calc(${inline}px + env(safe-area-inset-right, 0px))`,
        paddingTop: inline,
        paddingBottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`,
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
