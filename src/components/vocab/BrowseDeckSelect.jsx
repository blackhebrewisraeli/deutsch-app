import { useId } from 'react';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';
import { DECKS as PRESET_DECKS } from '../../packs/de/decks';
import SectionLabel from '../ui/SectionLabel';

export const BROWSE_SCOPE_LABEL = 'Choose a deck';

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

const customItems = (customDecks) =>
  Object.entries(customDecks ?? {}).map(([id, deck]) => ({
    id,
    name: deck?.name || 'Your deck',
  }));

/**
 * Select-only deck picker for Browse. Same ids as Practice's DeckPicker, but
 * no generate / trash — those stay on Practice. A grouped native <select>
 * instead of a chip wall, so Browse can pick a deck without duplicating the
 * Practice picker or eating the first screen of a phone. Calls the shared
 * selectDeck path so Practice follows.
 *
 * Custom decks are options, not a placeholder: if Browse is showing a custom
 * deck's rows, the closed select names that deck.
 */
export default function BrowseDeckSelect({ deckId, onSelect, customDecks = {} }) {
  const selectId = useId();
  const extras = customItems(customDecks);
  const extraIds = new Set(extras.map((d) => d.id));
  const value = KNOWN_IDS.has(deckId) || extraIds.has(deckId) ? deckId : '';

  return (
    <>
      <SectionLabel
        as="label"
        htmlFor={selectId}
        style={{ display: 'block', marginBottom: SPACE[2] }}
      >
        {BROWSE_SCOPE_LABEL}
      </SectionLabel>
      <select
        id={selectId}
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
        {extras.length > 0 && (
          <optgroup label="Your decks">
            {extras.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </optgroup>
        )}
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
    </>
  );
}
