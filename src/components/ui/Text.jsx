import { TEXT, FONTS, FONT_SIZE } from '../../lib/theme';
import { TONE } from './tone';

const BODY_SIZE = { md: FONT_SIZE.md, sm: FONT_SIZE.base };

export function Body({ size = 'md', tone = 'default', as: Tag = 'p', style, children, ...rest }) {
  return (
    <Tag
      style={{
        fontFamily: FONTS.body,
        fontSize: BODY_SIZE[size] ?? BODY_SIZE.md,
        color: TONE[tone] ?? TONE.default,
        // WCAG 1.4.12's minimum for body text, and what Hero's subtitle already
        // used before this primitive existed.
        lineHeight: 1.5,
        // Spacing between blocks belongs to Stack, not to the text.
        margin: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// The uppercase mono label: captions, counts, kickers, section markers.
//
// Meta is PRESENTATIONAL, and that is a hazard worth stating. A 10px muted mono
// string beside a control is not that control's label — the control still needs
// its own aria-label, or an aria-labelledby pointing at this node. "The label is
// right there on screen" is the reasoning that made 52 aria-label attributes
// necessary after the fact.
//
// The uppercasing is CSS, never applied to the string, so the accessible name
// stays in its authored case and a screen reader reads a word rather than
// spelling out an acronym.
export function Meta({ tone = 'muted', as: Tag = 'span', style, children, ...rest }) {
  return (
    <Tag style={{ ...TEXT.label, color: TONE[tone] ?? TONE.muted, ...style }} {...rest}>
      {children}
    </Tag>
  );
}
