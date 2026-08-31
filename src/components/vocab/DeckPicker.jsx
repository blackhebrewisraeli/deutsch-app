import { Sparkles, Trash2 } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SHADOW,
} from '../../lib/theme';
import { SectionLabel } from '../UI';
import { AUTO_DECKS, DECK_GROUPS } from '../../packs/de/autoDecks';

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
  return (
    <div>
      <SectionLabel num="A" text="Preset Decks" />
      <div
        style={{
          borderRadius: RADIUS.lg,
          boxShadow: SHADOW.card,
          overflow: 'hidden',
          marginBottom: 24,
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
        {Object.entries(customDecks).map(([id, deck]) => (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              borderTop: `1px solid ${COLORS.inkA12}`,
              background: deckId === id ? COLORS.red : COLORS.paperDeep,
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={deckId === id}
              // The visible row is "✦ weather · 2 cards". A screen reader needs
              // to know what KIND of thing that is, which the sparkle cannot
              // convey — so the accessible name states it explicitly.
              aria-label={`Your Deck: ${deck.name || 'unnamed'} — ${deck.cards.length} ${plural(deck.cards.length, 'card', 'cards')}`}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '14px 16px',
                background: 'transparent',
                color: deckId === id ? COLORS.paper : COLORS.ink,
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
                  label would make them indistinguishable, which is the whole
                  point of the collection. Truncated rather than wrapped: the
                  row is a fixed-height control and a long topic must not
                  reflow it. */}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                ✦ {deck.name || 'Your Deck'}
              </span>
              <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.7 }}>
                {deck.cards.length} {plural(deck.cards.length, 'card', 'cards')}
              </span>
            </button>
            {onDelete && (
              /* Select and Remove are SIBLINGS, never nested: a <button> inside
                 a <button> is invalid HTML and browsers silently un-nest it. */
              <button
                type="button"
                onClick={() => onDelete(id)}
                aria-label={`Remove ${deck.name || 'your custom deck'}`}
                style={{
                  padding: '14px 16px',
                  background: 'transparent',
                  color: deckId === id ? COLORS.paper : COLORS.mute,
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
          </div>
        ))}
      </div>

      {DECK_GROUPS.filter((g) => g !== 'Curated').map((group) => (
        <div key={group} style={{ marginBottom: 16 }}>
          <SectionLabel num={group[0]} text={group} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AUTO_DECKS.filter((d) => d.group === group).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelect(d.id)}
                aria-pressed={deckId === d.id}
                style={{
                  padding: '8px 12px',
                  background: deckId === d.id ? COLORS.ink : COLORS.card,
                  color: deckId === d.id ? COLORS.paper : COLORS.ink,
                  border: 'none',
                  borderRadius: RADIUS.md,
                  fontFamily: FONTS.display,
                  fontSize: FONT_SIZE.base,
                  cursor: 'pointer',
                }}
              >
                {d.icon} {d.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      <SectionLabel num="B" text="Generate Custom" />
      <div
        style={{
          borderRadius: RADIUS.lg,
          boxShadow: SHADOW.card,
          padding: 16,
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
