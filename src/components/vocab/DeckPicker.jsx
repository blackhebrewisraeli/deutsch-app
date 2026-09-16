import { useEffect, useRef, useState } from 'react';
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

const AUTO_GROUPS = DECK_GROUPS.filter((g) => g !== 'Curated');

const groupSlug = (group) =>
  group
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

export const deckGroupTabId = (group) => `deck-group-tab-${groupSlug(group)}`;
export const deckGroupPanelId = (group) => `deck-group-panel-${groupSlug(group)}`;

// English pluralisation for the counts this picker renders. Local, exactly as
// packs/de/missions.js and quests.js each keep their own: the RULE is part of a
// language, so it belongs beside the words rather than in a shared util that
// would quietly impose "one vs many" on a language that does not work that way.
const plural = (n, one, many) => (n === 1 ? one : many);

const groupForDeck = (deckId) => {
  const group = AUTO_DECKS.find((d) => d.id === deckId)?.group;
  return AUTO_GROUPS.includes(group) ? group : null;
};

const scrollTabIntoStrip = (list, tab) => {
  if (!list || !tab) return;
  const left = tab.offsetLeft;
  const right = left + tab.offsetWidth;
  const viewLeft = list.scrollLeft;
  const viewRight = viewLeft + list.clientWidth;
  if (left < viewLeft) list.scrollLeft = left;
  else if (right > viewRight) list.scrollLeft = right - list.clientWidth;
};

// The four curated decks. Counts are fixed because these decks are authored,
// not derived from the lexicon like AUTO_DECKS are.
const PRESETS = [
  { id: 'greetings', name: 'Greetings', count: 10 },
  { id: 'food', name: 'Food & Drink', count: 10 },
  { id: 'travel', name: 'Travel', count: 10 },
  { id: 'numbers', name: 'Numbers', count: 10 },
];

function DeckRow({ id, name, count, active, onSelect, bordered }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      style={{
        width: '100%',
        minWidth: 0,
        padding: '14px 16px',
        background: active ? COLORS.ink : COLORS.card,
        color: active ? COLORS.paper : COLORS.ink,
        border: 'none',
        borderBottom: bordered ? `1px solid ${COLORS.inkA12}` : 'none',
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
        {name}
      </span>
      {count != null && (
        <span
          style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.6, flexShrink: 0 }}
        >
          {count} {plural(count, 'card', 'cards')}
        </span>
      )}
    </button>
  );
}

/**
 * Practice's select-only deck list: curated decks, the learner's custom decks,
 * and lexicon-derived auto decks. Generate and trash live on Custom
 * (`CustomDeckManager`) — this picker only reports which deck to practise.
 *
 * Auto-deck groups share one tab strip (VocabModeTabs' manual-activation
 * pattern: arrows move focus, click/Space/Enter commit). Only the active
 * group's decks render, as full-width rows matching the preset list.
 *
 * @param {{ deckId: string, onSelect: (id: string) => void,
 *           customDecks?: object }} props
 */
export default function DeckPicker({ deckId, onSelect, customDecks = {} }) {
  const tabRefs = useRef({});
  const tablistRef = useRef(null);
  const [activeGroup, setActiveGroup] = useState(() => groupForDeck(deckId) ?? AUTO_GROUPS[0]);
  const [focusedGroup, setFocusedGroup] = useState(null);

  useEffect(() => {
    const group = groupForDeck(deckId);
    if (group) setActiveGroup(group);
  }, [deckId]);

  const current = AUTO_GROUPS.includes(activeGroup) ? activeGroup : AUTO_GROUPS[0];
  const rovingKey = focusedGroup ?? current;
  const focusIndex = Math.max(0, AUTO_GROUPS.indexOf(rovingKey));
  const activeDecks = AUTO_DECKS.filter((d) => d.group === current);

  useEffect(() => {
    scrollTabIntoStrip(tablistRef.current, tabRefs.current[current]);
  }, [current]);

  const pickGroup = (group) => {
    if (group !== current) setActiveGroup(group);
  };

  const onTabKeyDown = (e) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let next = null;
    if (delta) next = (focusIndex + delta + AUTO_GROUPS.length) % AUTO_GROUPS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = AUTO_GROUPS.length - 1;
    if (next === null) return;
    e.preventDefault();
    const group = AUTO_GROUPS[next];
    tabRefs.current[group]?.focus();
    scrollTabIntoStrip(tablistRef.current, tabRefs.current[group]);
  };

  const onTablistBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocusedGroup(null);
  };

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

      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Auto decks"
        onKeyDown={onTabKeyDown}
        onBlur={onTablistBlur}
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: SPACE[2],
          overflowX: 'auto',
          minWidth: 0,
          width: '100%',
          marginBottom: SPACE[3],
          overscrollBehaviorX: 'contain',
        }}
      >
        {AUTO_GROUPS.map((group) => {
          const selected = group === current;
          return (
            <button
              key={group}
              type="button"
              role="tab"
              data-ui="button"
              id={deckGroupTabId(group)}
              aria-selected={selected}
              aria-controls={deckGroupPanelId(group)}
              tabIndex={group === AUTO_GROUPS[focusIndex] ? 0 : -1}
              ref={(el) => {
                tabRefs.current[group] = el;
              }}
              onFocus={() => setFocusedGroup(group)}
              onClick={() => pickGroup(group)}
              style={{
                flexShrink: 0,
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                padding: `${SPACE[2]}px ${SPACE[3]}px`,
                background: selected ? COLORS.ink : COLORS.surface,
                color: selected ? COLORS.paper : COLORS.ink,
                border: `1px solid ${selected ? COLORS.ink : COLORS.border}`,
                borderRadius: RADIUS.pill,
                boxShadow: 'none',
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                fontWeight: FONT_WEIGHT.bold,
                letterSpacing: LETTER_SPACING.wide,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: TRANSITION.fast,
                minWidth: 0,
              }}
            >
              {group}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={deckGroupPanelId(current)}
        aria-labelledby={deckGroupTabId(current)}
        style={{
          borderRadius: RADIUS.lg,
          border: BORDER.panel,
          overflow: 'hidden',
          marginBottom: SPACE[5],
          minWidth: 0,
        }}
      >
        {activeDecks.map((d, i) => (
          <DeckRow
            key={d.id}
            id={d.id}
            name={d.name}
            count={typeof d.auto?.count === 'number' ? d.auto.count : undefined}
            active={deckId === d.id}
            onSelect={onSelect}
            bordered={i < activeDecks.length - 1}
          />
        ))}
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
