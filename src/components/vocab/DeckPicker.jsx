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
 *           generating: boolean, onGenerate: () => void, onDelete?: () => void }} props
 */
export default function DeckPicker({
  deckId,
  onSelect,
  customCards,
  customTopic,
  onTopicChange,
  generating,
  onGenerate,
  onDelete,
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
                {d.count} cards
              </span>
            </button>
          );
        })}
        {customCards && (
          /* Select and Remove are SIBLINGS in a row, never nested: a <button>
             inside a <button> is invalid HTML and browsers silently un-nest it,
             changing the DOM out from under the tests. */
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              borderTop: `1px solid ${COLORS.inkA12}`,
              background: deckId === 'custom' ? COLORS.red : COLORS.paperDeep,
            }}
          >
            <button
              type="button"
              onClick={() => onSelect('custom')}
              aria-pressed={deckId === 'custom'}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '14px 16px',
                background: 'transparent',
                color: deckId === 'custom' ? COLORS.paper : COLORS.ink,
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
              <span>✦ Your Deck</span>
              <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.7 }}>
                {customCards.length} cards
              </span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label="Remove your custom deck"
                style={{
                  padding: '14px 16px',
                  background: 'transparent',
                  color: deckId === 'custom' ? COLORS.paper : COLORS.mute,
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
        )}
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
          onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
          placeholder="e.g. weather, animals, sports"
          disabled={generating}
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
          disabled={generating || !customTopic.trim()}
          style={{
            width: '100%',
            padding: 14,
            background: generating ? COLORS.mute : COLORS.red,
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
            cursor: generating ? 'not-allowed' : 'pointer',
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
