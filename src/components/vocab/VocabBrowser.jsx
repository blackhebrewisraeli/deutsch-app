import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import {
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
import { filterVocabRows, pageOfRows, statusCounts, ROWS_PER_PAGE } from '../../lib/vocabRows';
import { activePack } from '../../packs';
import VocabTable from './VocabTable';

// Search folds the pack's own keyboard substitutions (ß→ss, ä→ae) on top of the
// engine's mark-stripping, so both "strasse" and "kase" reach their entries from
// an ASCII keyboard. Composed here rather than in lib/vocabRows.js because the
// engine must stay language-blind — see AGENTS.md.
const SEARCH_RULES = { ...activePack.validation.target, stripCombiningMarks: true };

const FILTER_LABELS = {
  all: 'All',
  due: 'Due',
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
  learned: 'Learned',
};

/**
 * Search, filter, page and inspect one deck's words.
 */
export default function VocabBrowser({
  rows,
  mobile = false,
  onPractice,
  initialStatus = 'all',
  filters = ['all', 'due', 'new', 'learning', 'mastered', 'learned'],
  emptyMessage,
  deckName = '',
  deckId = '',
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const counts = useMemo(() => statusCounts(rows), [rows]);
  const filtered = useMemo(
    () => filterVocabRows(rows, { query, status, rules: SEARCH_RULES }),
    [rows, query, status]
  );
  const view = pageOfRows(filtered, page, ROWS_PER_PAGE);

  useEffect(() => {
    if (view.page !== page) setPage(view.page);
  }, [view.page, page]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
    setQuery('');
    setStatus(initialStatus);
  }, [deckId, initialStatus]);

  const onQuery = (value) => {
    setQuery(value);
    setPage(1);
  };

  const onStatus = (next) => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[3],
          alignItems: 'center',
          marginBottom: SPACE[4],
          minWidth: 0,
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[2],
            flex: '1 1 220px',
            minWidth: 0,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.md,
            boxShadow: SHADOW.inset,
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
          }}
        >
          <Search size={16} aria-hidden="true" color={COLORS.mute} />
          <span style={visuallyHidden}>Search this deck</span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search word or meaning"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: FONTS.body,
              fontSize: FONT_SIZE.md,
              color: COLORS.ink,
            }}
          />
        </label>
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[2],
          marginBottom: SPACE[4],
          minWidth: 0,
        }}
      >
        {filters.map((key) => {
          const active = key === status;
          return (
            <button
              key={key}
              type="button"
              data-ui="button"
              onClick={() => onStatus(key)}
              aria-pressed={active}
              style={{
                padding: `${SPACE[1]}px ${SPACE[3]}px`,
                background: active ? COLORS.ink : COLORS.surface,
                color: active ? COLORS.paper : COLORS.ink,
                border: `1px solid ${active ? COLORS.ink : COLORS.border}`,
                borderRadius: RADIUS.pill,
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                cursor: 'pointer',
                transition: TRANSITION.fast,
                whiteSpace: 'nowrap',
              }}
            >
              {FILTER_LABELS[key] ?? key} {counts[key] ?? 0}
            </button>
          );
        })}
      </div>

      <VocabTable
        rows={view.rows}
        expandedId={expandedId}
        onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
        onPractice={onPractice}
        mobile={mobile}
        emptyMessage={emptyMessage ?? 'No words match this search.'}
        caption={
          view.total === 0
            ? `${deckName} — no words match`.trim()
            : `${deckName} — showing ${view.from}–${view.to} of ${view.total}`.trim()
        }
      />

      {view.pageCount > 1 && (
        <nav
          aria-label="Pagination"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACE[4],
            marginTop: SPACE[4],
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={view.page <= 1}
            style={pagerButton(view.page <= 1)}
          >
            Previous
          </button>
          <span
            aria-live="polite"
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
            }}
          >
            Page {view.page} of {view.pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={view.page >= view.pageCount}
            style={pagerButton(view.page >= view.pageCount)}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

const pagerButton = (disabled) => ({
  padding: `${SPACE[2]}px ${SPACE[4]}px`,
  background: disabled ? COLORS.paperDeep : COLORS.surface,
  color: disabled ? COLORS.mute : COLORS.ink,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.pill,
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  fontWeight: FONT_WEIGHT.bold,
  letterSpacing: LETTER_SPACING.caps,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
