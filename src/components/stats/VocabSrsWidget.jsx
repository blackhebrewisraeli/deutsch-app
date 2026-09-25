import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  BORDER,
} from '../../lib/theme';
import { getDueCount, getMasteredCount, srsKey, MASTERED_BOX } from '../../lib/srs';
import { activePack } from '../../packs';
const { decks: PRESET_DECKS } = activePack.content;

const DECK_LABELS = {
  greetings: 'Greetings',
  food: 'Food & Drink',
  travel: 'Travel',
  numbers: 'Numbers',
};

// Section F — SRS overview: due-now count, mastered progress, per-deck bars.
export default function VocabSrsWidget({ srs, now }) {
  const dueTotal = getDueCount(srs, PRESET_DECKS, now);
  const masteredTotal = getMasteredCount(srs);
  const cardTotal = Object.values(PRESET_DECKS).reduce((sum, deck) => sum + deck.length, 0);

  return (
    <div>
      <div
        data-testid="vocab-srs-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(48px, auto) minmax(0, 1fr)',
          gap: SPACE[2],
          alignItems: 'center',
          paddingBottom: SPACE[2],
          marginBottom: SPACE[2],
          borderBottom: BORDER.panel,
          minWidth: 0,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[1],
            }}
          >
            DUE NOW
          </div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: FONT_SIZE['3xl'],
              fontWeight: FONT_WEIGHT.black,
              letterSpacing: LETTER_SPACING.tight,
              lineHeight: 1,
              color: dueTotal > 0 ? COLORS.red : COLORS.ink,
            }}
          >
            {dueTotal}
          </div>
          <div
            style={{
              fontFamily: FONTS.body,
              fontStyle: 'italic',
              fontSize: FONT_SIZE.tag,
              color: COLORS.mute,
              marginTop: SPACE[1],
            }}
          >
            card{dueTotal === 1 ? '' : 's'}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[1],
            }}
          >
            MASTERED · {masteredTotal} OF {cardTotal}
          </div>
          <div
            data-testid="vocab-mastered-track"
            style={{
              height: 6,
              borderRadius: RADIUS.pill,
              background: COLORS.paperDeep,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${cardTotal === 0 ? 0 : (masteredTotal / cardTotal) * 100}%`,
                height: '100%',
                background: COLORS.gold,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
        {Object.keys(PRESET_DECKS).map((deckId) => {
          const deck = PRESET_DECKS[deckId];
          let mastered = 0;
          let due = 0;
          for (const card of deck) {
            const entry = srs[srsKey(deckId, card.id)];
            if (entry?.box === MASTERED_BOX) mastered += 1;
            if (!entry || entry.nextDue <= now) due += 1;
          }
          const masteredPct = Math.round((mastered / deck.length) * 100);
          return (
            <div key={deckId}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: SPACE[1],
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  color: COLORS.ink,
                }}
              >
                <span style={{ letterSpacing: LETTER_SPACING.caps }}>
                  {DECK_LABELS[deckId]?.toUpperCase() ?? deckId.toUpperCase()}
                </span>
                <span style={{ color: COLORS.mute }}>
                  {mastered}/{deck.length} mastered{due > 0 ? ` · ${due} due` : ''}
                </span>
              </div>
              <div
                data-testid="vocab-deck-track"
                style={{
                  height: 5,
                  borderRadius: RADIUS.pill,
                  background: COLORS.paperDeep,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${masteredPct}%`,
                    height: '100%',
                    background: COLORS.gold,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
