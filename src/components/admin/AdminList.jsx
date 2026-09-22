import { BORDER, COLORS, FONTS, FONT_SIZE, LETTER_SPACING, SPACE } from '../../lib/theme';
import { Stack } from '../ui/Layout';
import { Meta } from '../ui/Text';

/**
 * A flat, hairline-separated list — the admin lane's replacement for a column
 * of nested Surfaces.
 *
 * WHY NOT CARDS: the panel is already a Surface. Putting a bordered, shadowed,
 * 22px-radius card around every row nested one plane inside another and drew a
 * heavy box around each of forty feedback reports, so the eye spent its whole
 * budget on chrome and none on the text. A 1px rule separates rows for free and
 * has no corner radius to align, no shadow to stack, and no padding to double.
 *
 * The rule goes on every row but the FIRST, via a border-top rather than a
 * border-bottom: a trailing rule under the last row reads as the start of a
 * section that is not there.
 */
export function AdminList({ children, ...rest }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }} {...rest}>
      {children}
    </div>
  );
}

export function AdminListRow({ first = false, children, ...rest }) {
  return (
    <div
      style={{
        minWidth: 0,
        paddingTop: first ? 0 : SPACE[4],
        paddingBottom: SPACE[4],
        borderTop: first ? 'none' : BORDER.panel,
      }}
      {...rest}
    >
      <Stack gap={3}>{children}</Stack>
    </div>
  );
}

/**
 * The mono detail line every admin row carries: ids, providers, surfaces.
 *
 * It is `Meta`'s recipe at a readable case — deliberately NOT uppercased,
 * because these strings are UUIDs and email-shaped values where uppercasing
 * destroys the only visual cue to where one token ends and the next begins.
 */
export function AdminDetail({ children, ...rest }) {
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.normal,
        color: COLORS.mute,
        overflowWrap: 'anywhere',
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** A tiny state word beside a row: `admin`, `system`, `blocked`, `handled`. */
export function AdminFlag({ tone = 'muted', children }) {
  return (
    <Meta tone={tone} style={{ letterSpacing: LETTER_SPACING.wider }}>
      {children}
    </Meta>
  );
}
