import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, SPACE } from '../../lib/theme';
import { activePack } from '../../packs';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';

export const PRESET_GROUP_LABEL = 'Preset Decks';
export const CUSTOM_GROUP_LABEL = 'Your decks';

/**
 * Compact grouped options for the Browse deck <select>. Same catalogue as
 * Practice's DeckPicker (presets, live custom decks, auto groups) without
 * generate / delete / chip walls.
 */
function browseDeckGroups(customDecks = {}) {
  const groups = [];

  const presets = Object.entries(activePack.content.deckDefs ?? {}).map(([id, def]) => ({
    id,
    name: def.name,
  }));
  if (presets.length) groups.push({ label: PRESET_GROUP_LABEL, options: presets });

  const custom = Object.entries(customDecks).map(([id, deck]) => ({
    id,
    name: deck.name || 'Your deck',
  }));
  if (custom.length) groups.push({ label: CUSTOM_GROUP_LABEL, options: custom });

  for (const group of DECK_GROUPS.filter((g) => g !== 'Curated')) {
    const options = AUTO_DECKS.filter((d) => d.group === group).map((d) => ({
      id: d.id,
      name: d.name,
    }));
    if (options.length) groups.push({ label: group, options });
  }

  return groups;
}

/**
 * Native grouped <select> that writes the shared VocabTab deckId.
 */
export default function BrowseDeckSelect({
  id,
  deckId,
  onSelect,
  customDecks = {},
  'aria-labelledby': ariaLabelledBy,
}) {
  const groups = browseDeckGroups(customDecks);

  return (
    <select
      id={id}
      data-ui="select"
      aria-label={ariaLabelledBy ? undefined : 'Deck'}
      aria-labelledby={ariaLabelledBy}
      value={deckId}
      onChange={(event) => onSelect?.(event.target.value)}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        background: COLORS.card,
        color: COLORS.ink,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.inset,
        fontFamily: FONTS.body,
        fontSize: FONT_SIZE.md,
      }}
    >
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
