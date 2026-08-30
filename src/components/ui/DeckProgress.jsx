import { COLORS, FONTS, FONT_SIZE, LETTER_SPACING, RADIUS } from '../../lib/theme';
import { isLearned, learnedInDeck } from '../../lib/learnedWords';

// Above this many cards the per-card dot strip stops fitting: it is the only
// unbounded child of the progress row, so at 2,212 cards (the B1 deck) it
// dragged the page 54x wider than the viewport. Small decks — the four curated
// decks and a generated one, 10 cards each — keep the dots.
const DOT_THRESHOLD = 12;

// Per-card progress for the active deck: dots for small decks, a bounded bar
// plus a count for lexicon-sized ones. Bounded DOM either way.
export default function DeckProgress({ cards, learnedWords, learnedByDeck = null, deckId }) {
  if (!cards?.length) return null;

  const total = cards.length;
  const learned = learnedInDeck({ learnedByDeck, learnedWords, deckId, cards });

  if (total <= DOT_THRESHOLD) {
    return (
      <div style={{ display: 'flex', gap: 5, minWidth: 0 }}>
        {cards.map((c, i) => (
          <div
            key={i}
            data-testid="deck-progress-dot"
            style={{
              flex: '0 1 26px',
              width: 26,
              height: 8,
              borderRadius: RADIUS.pill,
              background: isLearned({ learnedByDeck, learnedWords, deckId, cardId: c.id })
                ? COLORS.green
                : COLORS.track,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div
        role="progressbar"
        aria-label="Words learned in this deck"
        aria-valuenow={learned}
        aria-valuemin={0}
        aria-valuemax={total}
        style={{
          width: 120,
          height: 8,
          borderRadius: RADIUS.pill,
          background: COLORS.track,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(learned / total) * 100}%`,
            height: '100%',
            borderRadius: RADIUS.pill,
            background: COLORS.green,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          letterSpacing: LETTER_SPACING.caps,
          color: COLORS.mute,
          whiteSpace: 'nowrap',
        }}
      >
        {learned} / {total} LEARNED
      </span>
    </div>
  );
}
