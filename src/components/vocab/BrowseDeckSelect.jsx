import {
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

const PRESETS = [
  { id: 'greetings', name: 'Greetings' },
  { id: 'food', name: 'Food & Drink' },
  { id: 'travel', name: 'Travel' },
  { id: 'numbers', name: 'Numbers' },
];

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

const ChipRow = ({ children }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: SPACE[2],
      minWidth: 0,
    }}
  >
    {children}
  </div>
);

/**
 * Select-only deck picker for Browse. Same ids as Practice's DeckPicker, but
 * no generate / trash — those stay on Practice. Calls the shared selectDeck
 * path so Practice follows.
 */
export default function BrowseDeckSelect({ deckId, onSelect }) {
  return (
    <div style={{ minWidth: 0, marginBottom: SPACE[4] }} aria-label="Select a deck to browse">
      <SectionLabel style={{ marginBottom: SPACE[2] }}>Preset decks</SectionLabel>
      <ChipRow>
        {PRESETS.map((d) => {
          const active = deckId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              data-ui="button"
              onClick={() => onSelect?.(d.id)}
              aria-pressed={active}
              style={chipStyle(active)}
            >
              {d.name}
            </button>
          );
        })}
      </ChipRow>

      {DECK_GROUPS.filter((g) => g !== 'Curated').map((group) => (
        <div key={group} style={{ marginTop: SPACE[4], minWidth: 0 }}>
          <SectionLabel style={{ marginBottom: SPACE[2] }}>{group}</SectionLabel>
          <ChipRow>
            {AUTO_DECKS.filter((d) => d.group === group).map((d) => {
              const active = deckId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  data-ui="button"
                  onClick={() => onSelect?.(d.id)}
                  aria-pressed={active}
                  style={chipStyle(active)}
                >
                  {d.name}
                </button>
              );
            })}
          </ChipRow>
        </div>
      ))}
    </div>
  );
}
