import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
  TRANSITION,
} from '../../lib/theme';
import SectionLabel from '../ui/SectionLabel';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';

// Tailwind max-w-md — keeps the picker a single readable column on a wide screen.
const PICKER_MAX_WIDTH = 448;

const chipStyle = (active) => ({
  padding: `${SPACE[2]}px ${SPACE[3]}px`,
  background: active ? COLORS.ink : COLORS.surface,
  color: active ? COLORS.paper : COLORS.ink,
  border: `1px solid ${active ? COLORS.ink : COLORS.border}`,
  borderRadius: RADIUS.pill,
  boxShadow: 'none',
  fontFamily: FONTS.body,
  fontSize: FONT_SIZE.sm,
  fontWeight: FONT_WEIGHT.medium,
  letterSpacing: LETTER_SPACING.wide,
  cursor: 'pointer',
  transition: TRANSITION.fast,
  minWidth: 0,
  maxWidth: '100%',
});

// English pluralisation for the counts this picker renders. Local, exactly as
// packs/de/missions.js and quests.js each keep their own: the RULE is part of a
// language, so it belongs beside the words rather than in a shared util that
// would quietly impose "one vs many" on a language that does not work that way.
const plural = (n, one, many) => (n === 1 ? one : many);

// The four curated decks. Counts are fixed because these decks are authored,
// not derived from the lexicon like AUTO_DECKS are.
const PRESETS = [
  { id: 'greetings', name: 'Greetings', count: 10 },
  { id: 'food', name: 'Food & Drink', count: 10 },
  { id: 'travel', name: 'Travel', count: 10 },
  { id: 'numbers', name: 'Numbers', count: 10 },
];

/**
 * Practice's select-only deck list: curated decks, the learner's custom decks,
 * and lexicon-derived auto decks. Generate and trash live on Custom
 * (`CustomDeckManager`) — this picker only reports which deck to practise.
 *
 * @param {{ deckId: string, onSelect: (id: string) => void,
 *           customDecks?: object }} props
 */
export default function DeckPicker({ deckId, onSelect, customDecks = {} }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: PICKER_MAX_WIDTH,
        marginLeft: 'auto',
        marginRight: 'auto',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <SectionLabel>Preset Decks</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.lg,
          border: BORDER.panel,
          overflow: 'hidden',
          marginBottom: SPACE[5],
        }}
      >
        {PRESETS.map((d, i) => {
          const active = deckId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              aria-pressed={active}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: active ? COLORS.ink : COLORS.card,
                color: active ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderBottom: i < PRESETS.length - 1 ? `1px solid ${COLORS.inkA12}` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.lg,
                fontWeight: FONT_WEIGHT.semibold,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span>{d.name}</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.6 }}>
                {d.count} {plural(d.count, 'card', 'cards')}
              </span>
            </button>
          );
        })}
        {/* Select-only custom rows. Generate / trash moved to Custom in P4. */}
        {Object.entries(customDecks).map(([id, deck]) => {
          const deckName = deck.name || 'Your Deck';
          const selected = deckId === id;
          const count = deck.cards?.length ?? 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={selected}
              aria-label={`Your Deck: ${deck.name || 'unnamed'} — ${count} ${plural(count, 'card', 'cards')}`}
              style={{
                width: '100%',
                minWidth: 0,
                padding: '14px 16px',
                background: selected ? COLORS.red : COLORS.paperDeep,
                color: selected ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderTop: `1px solid ${COLORS.inkA12}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                fontFamily: FONTS.display,
                fontSize: FONT_SIZE.lg,
                fontWeight: FONT_WEIGHT.semibold,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                ✦ {deckName}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.7 }}>
                {count} {plural(count, 'card', 'cards')}
              </span>
            </button>
          );
        })}
      </div>

      {DECK_GROUPS.filter((g) => g !== 'Curated').map((group) => (
        <div key={group} style={{ marginBottom: SPACE[5], minWidth: 0 }}>
          <SectionLabel>{group}</SectionLabel>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: SPACE[2],
              minWidth: 0,
            }}
          >
            {AUTO_DECKS.filter((d) => d.group === group).map((d) => (
              <button
                key={d.id}
                type="button"
                data-ui="button"
                onClick={() => onSelect(d.id)}
                aria-pressed={deckId === d.id}
                style={chipStyle(deckId === d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div
        style={{
          marginTop: 12,
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.tag,
          color: COLORS.mute,
        }}
      >
        Vocabulary from Wiktionary (CC BY-SA), Tatoeba &amp; Leipzig (CC BY).
      </div>
    </div>
  );
}
