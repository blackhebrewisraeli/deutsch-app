import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../../lib/theme';
import { formatVerb } from '../../lib/verbDisplay';
import { activePack } from '../../packs';

/**
 * The card face — always the target language. Everything below the headword is
 * optional and driven by what the lexicon entry happens to carry.
 *
 * `display` overrides the headword. The gender drill passes the bare lemma,
 * because `card.de` is the composed form "das Jahr" and would print the answer
 * above the buttons asking for it.
 *
 * `conceal` names fields the face must not render, for the same reason one step
 * further down: the plural drill asks for a form this card would otherwise print
 * on its "PL:" line. Any drill that asks for something the card knows has to
 * hide it, so this is a list rather than a second boolean.
 *
 * @param {{ card: object, learned: boolean, mobile: boolean, display?: string,
 *           conceal?: string[] }} props
 */
export default function CardFace({ card, learned, mobile, display, conceal = [] }) {
  const hidden = (field) => conceal.includes(field);
  return (
    <div
      style={{
        borderRadius: RADIUS.xl,
        boxShadow: SHADOW.cardChunk,
        background: COLORS.card,
        minHeight: 200,
        // 48px of padding on each side costs a quarter of a 375px
        // phone screen — step it down so the word gets the room.
        padding: mobile ? SPACE[5] : SPACE[12],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        marginBottom: SPACE[5],
        position: 'relative',
      }}
    >
      {learned && (
        <div
          style={{
            position: 'absolute',
            top: SPACE[3],
            left: SPACE[3],
            background: COLORS.green,
            color: COLORS.paper,
            padding: '4px 10px',
            borderRadius: RADIUS.pill,
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.widest,
          }}
        >
          ✓ LEARNED
        </div>
      )}
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: mobile ? FONT_SIZE['5xl'] : FONT_SIZE['6xl'],
          fontWeight: FONT_WEIGHT.bold,
          letterSpacing: LETTER_SPACING.tight,
          marginBottom: SPACE[4],
          // German compounds are long and unbreakable by default, so
          // the word sets the card's min-content width and drags the
          // whole page wider than the viewport. Let it break instead.
          overflowWrap: 'anywhere',
          maxWidth: '100%',
        }}
      >
        {display ?? card.de}
      </div>
      {card.ipa && !hidden('ipa') && (
        <div style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.6 }}>
          {card.ipa}
        </div>
      )}
      {card.plural && !hidden('plural') && (
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
            marginTop: SPACE[2],
          }}
        >
          PL: {card.plural}
        </div>
      )}
      {!hidden('verb') &&
        formatVerb(card.verb, activePack.grammar).map((line) => (
          <div
            key={line.label}
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginTop: SPACE[2],
            }}
          >
            {line.label}: {line.value}
          </div>
        ))}
      {card.examples?.length > 0 && (
        <div
          style={{
            marginTop: SPACE[3],
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.md,
            fontStyle: 'italic',
            opacity: 0.75,
          }}
        >
          {card.examples[0].de}
        </div>
      )}
    </div>
  );
}
