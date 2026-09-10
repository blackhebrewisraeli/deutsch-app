import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';
import { DECKS as PRESET_DECKS } from '../../packs/de/decks';

const GROUPS = [
  {
    label: 'Preset decks',
    items: Object.entries(PRESET_DECKS).map(([id, deck]) => ({ id, name: deck.name })),
  },
  ...DECK_GROUPS.filter((g) => g !== 'Curated').map((label) => ({
    label,
    items: AUTO_DECKS.filter((d) => d.group === label).map(({ id, name }) => ({ id, name })),
  })),
];

const KNOWN_IDS = new Set(GROUPS.flatMap((g) => g.items.map((d) => d.id)));

/**
 * Select-only deck picker for Browse. Same ids as Practice's DeckPicker, but
 * no generate / trash — those stay on Practice. A grouped native <select>
 * instead of a chip wall, so Browse can pick a deck without duplicating the
 * Practice picker or eating the first screen of a phone. Calls the shared
 * selectDeck path so Practice follows.
 */
export default function BrowseDeckSelect({ deckId, onSelect }) {
  const value = KNOWN_IDS.has(deckId) ? deckId : '';

  return (
    <select
      aria-label="Select a deck to browse"
      data-ui="select"
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (next) onSelect?.(next);
      }}
      style={{
        display: 'block',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        marginBottom: SPACE[3],
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        background: COLORS.surface,
        color: COLORS.ink,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.inset,
        fontFamily: FONTS.body,
        fontSize: FONT_SIZE.sm,
        cursor: 'pointer',
      }}
    >
      <option value="" disabled>
        Select a deck
      </option>
      {GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
