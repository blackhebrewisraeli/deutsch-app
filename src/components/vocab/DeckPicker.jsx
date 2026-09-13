import { useEffect, useRef, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SHADOW,
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
 * Everything the learner picks from: curated decks, their own generated deck,
 * the lexicon-derived auto decks, and the generate form.
 *
 * @param {{ deckId: string, onSelect: (id: string) => void, customCards: object[]|null,
 *           customTopic: string, onTopicChange: (t: string) => void,
 *           generating: boolean, onGenerate: () => void, onDelete?: (id: string) => void,
 *           atCap?: boolean, maxDecks?: number }} props
 */
export default function DeckPicker({
  deckId,
  onSelect,
  customDecks = {},
  customTopic,
  onTopicChange,
  generating,
  onGenerate,
  onDelete,
  atCap = false,
  maxDecks,
}) {
  // One deck at a time. Arming a second row replaces this id, so two
  // confirmations never sit side by side waiting for a stray click.
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // Only one row is ever armed, so one ref is enough for the confirm.
  const confirmRef = useRef(null);
  // id -> that row's trash button, so focus can be handed back to it.
  const trashRefs = useRef(new Map());
  // Which row's trash should take focus once the strip closes.
  const restoreFocusId = useRef(null);

  // Arming swaps the trash out for the confirm strip, and closing swaps it
  // back; either way the button the keyboard user just activated unmounts, and
  // focus would land on <body>.
  useEffect(() => {
    if (pendingDeleteId) {
      confirmRef.current?.focus();
      return;
    }
    const id = restoreFocusId.current;
    restoreFocusId.current = null;
    if (id) trashRefs.current.get(id)?.focus();
  }, [pendingDeleteId]);

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
        {/* One row per custom deck. With a single deck this renders exactly
            what the single-slot version did. */}
        {Object.entries(customDecks).map(([id, deck], row, rows) => {
          const deckName = deck.name || 'Your Deck';
          const pending = pendingDeleteId === id;
          const selected = deckId === id;

          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderTop: `1px solid ${COLORS.inkA12}`,
                // Confirmation sits on the unselected surface so a red Remove
                // control stays readable even when this row is the active deck.
                background: pending ? COLORS.paperDeep : selected ? COLORS.red : COLORS.paperDeep,
              }}
            >
              {pending ? (
                <div
                  // Escape is how a dismissible affordance is backed out of.
                  // Focus is inside the strip while it is armed, so the keydown
                  // reaches this wrapper by bubbling.
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return;
                    restoreFocusId.current = id;
                    setPendingDeleteId(null);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE[2],
                    padding: '14px 16px',
                  }}
                >
                  {/* The same live region the at-cap note below uses. Arming a
                      row swaps the controls out from under a screen reader; the
                      question itself has to be spoken, not just drawn. */}
                  <span
                    role="status"
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: FONT_SIZE.sm,
                      fontWeight: FONT_WEIGHT.medium,
                      color: COLORS.ink,
                      overflowWrap: 'anywhere',
                      minWidth: 0,
                    }}
                  >
                    {`Remove ${deckName}? Cards can't be recovered.`}
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                      gap: SPACE[2],
                    }}
                  >
                    <button
                      ref={confirmRef}
                      type="button"
                      data-ui="button"
                      // The visible word is a bare "Remove", which in a tree
                      // that also holds "Remove weather" and "Remove food"
                      // leaves the ONLY button that destroys data as the least
                      // identified one. "permanently" also separates this from
                      // the trash it replaced, so activating the trash does not
                      // announce the same name twice.
                      aria-label={`Remove ${deckName} permanently`}
                      onClick={() => {
                        // This row is about to vanish, so focus goes to the row
                        // that takes its place — the next one, or the previous
                        // when this was the last. With no row left there is no
                        // trash to hold focus at all.
                        const neighbour = rows[row + 1] || rows[row - 1];
                        restoreFocusId.current = neighbour ? neighbour[0] : null;
                        onDelete(id);
                        setPendingDeleteId(null);
                      }}
                      style={{
                        minWidth: 0,
                        padding: `${SPACE[2]}px ${SPACE[3]}px`,
                        background: COLORS.red,
                        color: COLORS.paper,
                        border: 'none',
                        borderRadius: RADIUS.md,
                        boxShadow: SHADOW.press(COLORS.rust),
                        fontFamily: FONTS.mono,
                        fontSize: FONT_SIZE.tag,
                        fontWeight: FONT_WEIGHT.bold,
                        letterSpacing: LETTER_SPACING.wider,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      data-ui="button"
                      onClick={() => {
                        restoreFocusId.current = id;
                        setPendingDeleteId(null);
                      }}
                      style={{
                        minWidth: 0,
                        padding: `${SPACE[2]}px ${SPACE[3]}px`,
                        background: COLORS.card,
                        color: COLORS.ink,
                        border: 'none',
                        borderRadius: RADIUS.md,
                        boxShadow: SHADOW.press(COLORS.lip),
                        fontFamily: FONTS.mono,
                        fontSize: FONT_SIZE.tag,
                        fontWeight: FONT_WEIGHT.bold,
                        letterSpacing: LETTER_SPACING.wider,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    aria-pressed={selected}
                    // The visible row is "✦ weather · 2 cards". A screen reader
                    // needs to know what KIND of thing that is, which the
                    // sparkle cannot convey — so the accessible name states it
                    // explicitly.
                    aria-label={`Your Deck: ${deck.name || 'unnamed'} — ${deck.cards.length} ${plural(deck.cards.length, 'card', 'cards')}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '14px 16px',
                      background: 'transparent',
                      color: selected ? COLORS.paper : COLORS.ink,
                      border: 'none',
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
                    {/* The topic the learner typed. With several decks a fixed
                        label would make them indistinguishable, which is the
                        whole point of the collection. Truncated rather than
                        wrapped: the row is a fixed-height control and a long
                        topic must not reflow it. */}
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
                      {deck.cards.length} {plural(deck.cards.length, 'card', 'cards')}
                    </span>
                  </button>
                  {onDelete && (
                    /* Select and Remove are SIBLINGS, never nested: a <button>
                       inside a <button> is invalid HTML and browsers silently
                       un-nest it. First click only arms this row. */
                    <button
                      ref={(node) => {
                        if (node) trashRefs.current.set(id, node);
                        else trashRefs.current.delete(id);
                      }}
                      type="button"
                      onClick={() => setPendingDeleteId(id)}
                      aria-label={`Remove ${deck.name || 'your custom deck'}`}
                      style={{
                        padding: '14px 16px',
                        background: 'transparent',
                        color: selected ? COLORS.paper : COLORS.mute,
                        border: 'none',
                        borderLeft: `1px solid ${COLORS.inkA12}`,
                        fontFamily: FONTS.mono,
                        fontSize: FONT_SIZE.ipa,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
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

      <SectionLabel>Generate Custom</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.lg,
          border: BORDER.panel,
          padding: SPACE[4],
          background: COLORS.paperDeep,
        }}
      >
        <input
          aria-label="Custom deck topic"
          value={customTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !atCap && onGenerate()}
          placeholder="e.g. weather, animals, sports"
          disabled={generating || atCap}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 12,
            background: COLORS.card,
            border: 'none',
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.inset,
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.md,
            marginBottom: 12,
            color: COLORS.ink,
          }}
        />
        <button
          onClick={onGenerate}
          disabled={generating || atCap || !customTopic.trim()}
          style={{
            width: '100%',
            padding: 14,
            background: generating || atCap ? COLORS.mute : COLORS.red,
            color: COLORS.card,
            border: 'none',
            fontFamily: FONTS.mono,
            fontWeight: FONT_WEIGHT.bold,
            fontSize: FONT_SIZE.sm,
            letterSpacing: LETTER_SPACING.widest,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: generating || atCap ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? (
            'GENERATING...'
          ) : (
            <>
              <Sparkles size={14} aria-hidden="true" /> GENERATE 10 CARDS
            </>
          )}
        </button>

        {/* A disabled control with no reason is a dead end. Rendered as a live
            region so the explanation reaches a screen reader at the moment the
            cap is hit, not only on a fresh render. */}
        {atCap && (
          <div
            role="status"
            style={{
              marginTop: 10,
              fontFamily: FONTS.body,
              fontSize: FONT_SIZE.ipa,
              color: COLORS.mute,
              textAlign: 'center',
            }}
          >
            {maxDecks} decks is the limit — remove one to make another.
          </div>
        )}
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
