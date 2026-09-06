import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, SPACE } from '../../lib/theme';
import StatusNote from '../ui/StatusNote';
import SectionLabel from '../ui/SectionLabel';
import VocabBrowser from './VocabBrowser';
import { toVocabRows } from '../../lib/vocabRows';

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * View-only browse surface. Title and empty copy are props so no German
 * chrome lands in this file. When `customDecks` is passed this is the Custom
 * tab: a list of user decks (no trash) plus the table for the selected one.
 *
 * `srs`, learned maps and `now` are injected — this component must not call
 * loadState() or Date.now() in render.
 */
export default function VocabBrowse({
  title,
  cards = [],
  deckId,
  loading = false,
  error = false,
  onRetry,
  mobile = false,
  emptyMessage = 'Select a deck to browse.',
  customDecks = null,
  onSelectDeck,
  onPractice,
  srs = {},
  learnedWords = null,
  learnedByDeck = null,
  now,
}) {
  const isCustomMode = customDecks !== null;
  const customEntries = isCustomMode ? Object.entries(customDecks) : [];
  const selectedIsCustom = Boolean(customDecks?.[deckId]);
  const showTable = !loading && !error && cards.length > 0 && (!isCustomMode || selectedIsCustom);

  const rows = useMemo(
    () =>
      toVocabRows({
        cards,
        deckId,
        deckName: title,
        learnedWords,
        learnedByDeck,
        srs,
        now,
      }),
    [cards, deckId, title, learnedWords, learnedByDeck, srs, now]
  );

  return (
    <div style={{ width: '100%', minWidth: 0, marginTop: SPACE[8] }}>
      {isCustomMode && (
        <div style={{ marginBottom: SPACE[5] }}>
          <SectionLabel>Your decks</SectionLabel>
          {customEntries.length === 0 ? (
            <p
              style={{
                fontFamily: FONTS.body,
                fontSize: FONT_SIZE.base,
                color: COLORS.mute,
                margin: 0,
              }}
            >
              {emptyMessage}
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE[2],
                minWidth: 0,
              }}
            >
              {customEntries.map(([id, deck]) => {
                const active = deckId === id;
                const count = deck.cards?.length ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectDeck?.(id)}
                    aria-pressed={active}
                    aria-label={`${deck.name || 'unnamed'} — ${count} ${plural(count, 'card', 'cards')}`}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      padding: '14px 16px',
                      background: active ? COLORS.ink : COLORS.card,
                      color: active ? COLORS.paper : COLORS.ink,
                      border: `1px solid ${active ? COLORS.ink : COLORS.border}`,
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
                      {deck.name || 'Your deck'}
                    </span>
                    <span style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.6 }}>
                      {count} {plural(count, 'card', 'cards')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isCustomMode && title && (
        <h2
          style={{
            fontFamily: FONTS.display,
            fontSize: FONT_SIZE['2xl'],
            fontWeight: FONT_WEIGHT.semibold,
            margin: `0 0 ${SPACE[5]}px`,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </h2>
      )}

      {loading && (
        <div
          style={{
            padding: SPACE[8],
            textAlign: 'center',
            fontFamily: FONTS.mono,
            color: COLORS.mute,
          }}
        >
          Loading deck…
        </div>
      )}

      {error && (
        <StatusNote tone="error" icon={AlertTriangle} action={{ label: 'Retry', onClick: onRetry }}>
          Could not load this deck.
        </StatusNote>
      )}

      {!loading && !error && !showTable && !isCustomMode && (
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.base,
            color: COLORS.mute,
            textAlign: 'center',
          }}
        >
          {emptyMessage}
        </p>
      )}

      {isCustomMode && customEntries.length > 0 && !selectedIsCustom && (
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.base,
            color: COLORS.mute,
          }}
        >
          Select a custom deck to inspect it.
        </p>
      )}

      {showTable && (
        <VocabBrowser
          rows={rows}
          deckId={deckId}
          deckName={title}
          mobile={mobile}
          onPractice={onPractice}
        />
      )}
    </div>
  );
}
