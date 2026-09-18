import { useEffect, useId, useState } from 'react';
import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  RADIUS,
  SHADOW,
  SPACE,
} from '../../lib/theme';
import SectionLabel from '../ui/SectionLabel';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';
import { filterCatalogByLevel } from '../../lib/levelGate';
import { getUserLevel } from '../../lib/levelPref';

// Tailwind max-w-md — keeps the picker a single readable column on a wide screen.
const PICKER_MAX_WIDTH = 448;

const AUTO_GROUPS = DECK_GROUPS.filter((g) => g !== 'Curated');

const SELECT_STYLE = {
  display: 'block',
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
  padding: `${SPACE[2]}px ${SPACE[3]}px`,
  background: COLORS.surface,
  color: COLORS.ink,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.md,
  boxShadow: SHADOW.inset,
  fontFamily: FONTS.body,
  fontSize: FONT_SIZE.sm,
  cursor: 'pointer',
};

// English pluralisation for the counts this picker renders. Local, exactly as
// packs/de/missions.js and quests.js each keep their own: the RULE is part of a
// language, so it belongs beside the words rather than in a shared util that
// would quietly impose "one vs many" on a language that does not work that way.
const plural = (n, one, many) => (n === 1 ? one : many);

const groupForDeck = (deckId) => {
  const group = AUTO_DECKS.find((d) => d.id === deckId)?.group;
  return AUTO_GROUPS.includes(group) ? group : null;
};

const deckOptionLabel = (d) => {
  const count = typeof d.auto?.count === 'number' ? d.auto.count : undefined;
  if (count == null) return d.name;
  return `${d.name} (${count} ${plural(count, 'card', 'cards')})`;
};

function AutoSelect({ id, label, value, onChange, children }) {
  return (
    <div style={{ minWidth: 0, width: '100%' }}>
      <SectionLabel as="label" htmlFor={id} style={{ display: 'block', marginBottom: SPACE[2] }}>
        {label}
      </SectionLabel>
      <select id={id} data-ui="select" value={value} onChange={onChange} style={SELECT_STYLE}>
        {children}
      </select>
    </div>
  );
}

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
 * Auto decks are a form-style cascade: a group <select> feeds a deck <select>
 * that lists only that group's decks. Choosing a deck calls onSelect; changing
 * the group does not. Presets stay a vertical list above the cascade.
 *
 * @param {{ deckId: string, onSelect: (id: string) => void,
 *           customDecks?: object, level?: string }} props
 */
export default function DeckPicker({ deckId, onSelect, customDecks = {}, level = getUserLevel() }) {
  const groupSelectId = useId();
  const deckSelectId = useId();
  const [activeGroup, setActiveGroup] = useState(() => groupForDeck(deckId) ?? AUTO_GROUPS[0]);

  useEffect(() => {
    const group = groupForDeck(deckId);
    if (group) setActiveGroup(group);
  }, [deckId]);

  const current = AUTO_GROUPS.includes(activeGroup) ? activeGroup : AUTO_GROUPS[0];
  const allowedAuto = filterCatalogByLevel(AUTO_DECKS, level);
  const activeDecks = allowedAuto.filter((d) => d.group === current);
  const deckValue = activeDecks.some((d) => d.id === deckId) ? deckId : '';

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
          minWidth: 0,
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
                minWidth: 0,
                padding: '14px 16px',
                background: active ? COLORS.ink : COLORS.card,
                color: active ? COLORS.paper : COLORS.ink,
                border: 'none',
                borderBottom: i < PRESETS.length - 1 ? `1px solid ${COLORS.inkA12}` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: SPACE[2],
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
                {d.name}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.ipa,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              >
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: SPACE[3],
          width: '100%',
          minWidth: 0,
          marginBottom: SPACE[5],
          boxSizing: 'border-box',
        }}
      >
        <AutoSelect
          id={groupSelectId}
          label="Group"
          value={current}
          onChange={(e) => setActiveGroup(e.target.value)}
        >
          {AUTO_GROUPS.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </AutoSelect>
        <AutoSelect
          id={deckSelectId}
          label="Deck"
          value={deckValue}
          onChange={(e) => {
            const next = e.target.value;
            if (next) onSelect(next);
          }}
        >
          <option value="" disabled>
            Select a deck
          </option>
          {activeDecks.map((d) => (
            <option key={d.id} value={d.id}>
              {deckOptionLabel(d)}
            </option>
          ))}
        </AutoSelect>
      </div>

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
