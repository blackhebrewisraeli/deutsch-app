import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, SPACE } from '../../lib/theme';
import StatusNote from '../ui/StatusNote';
import VocabBrowser from './VocabBrowser';
import BrowseDeckSelect from './BrowseDeckSelect';
import { toVocabRows } from '../../lib/vocabRows';

export { BROWSE_SCOPE_LABEL } from './BrowseDeckSelect';
export const CUSTOM_PICK_COPY = 'Select a custom deck to inspect it.';

/**
 * View-only browse surface. Title and empty copy are props so no German
 * chrome lands in this file. Browse picks a deck through `onSelectDeck` (the
 * shared Practice path) when `showSelector` is true. Custom owns generate
 * and trash in `CustomDeckManager` and mounts this table with
 * `showSelector={false}`.
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
  showSelector = true,
  selectableCustomDecks = {},
  onSelectDeck,
  onPractice,
  srs = {},
  learnedWords = null,
  learnedByDeck = null,
  now,
}) {
  const showTable = !loading && !error && cards.length > 0;
  const showHeader = showSelector || Boolean(title);

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
    <div
      style={{
        width: '100%',
        minWidth: 0,
        marginTop: mobile ? SPACE[4] : SPACE[6],
      }}
    >
      {showHeader && (
        <header style={{ marginBottom: SPACE[3], minWidth: 0 }}>
          {showSelector && (
            <BrowseDeckSelect
              deckId={deckId}
              onSelect={onSelectDeck}
              customDecks={selectableCustomDecks}
            />
          )}
          {title && (
            <h2
              style={{
                fontFamily: FONTS.display,
                fontSize: mobile ? FONT_SIZE.xl : FONT_SIZE['2xl'],
                fontWeight: FONT_WEIGHT.semibold,
                margin: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {title}
            </h2>
          )}
        </header>
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

      {!loading && !error && !showTable && emptyMessage && (
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.base,
            color: COLORS.mute,
            textAlign: showSelector ? 'center' : 'left',
          }}
        >
          {emptyMessage}
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
