import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
  TEXT,
} from '../../lib/theme';
import { glossText } from '../../lib/vocabRows';
import { formatVerb } from '../../lib/verbDisplay';
import { activePack } from '../../packs';

const STATUS_LABELS = {
  new: 'New',
  learning: 'Learning',
  mastered: 'Mastered',
};

const statusColor = (row) => {
  if (row.status === 'mastered') return COLORS.gold;
  if (row.status === 'learning') return COLORS.accentAlt;
  return COLORS.mute;
};

const EMPTY = '—';

function Pill({ children, background, color }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `2px ${SPACE[2]}px`,
        borderRadius: RADIUS.pill,
        background,
        color,
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.caps,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function StatusCell({ row }) {
  return (
    <span style={{ display: 'inline-flex', gap: SPACE[2], alignItems: 'center', flexWrap: 'wrap' }}>
      <Pill background={COLORS.paperDeep} color={statusColor(row)}>
        {STATUS_LABELS[row.status] ?? STATUS_LABELS.new}
      </Pill>
      {row.due && (
        <Pill background={COLORS.redSoft} color={COLORS.red}>
          Due
        </Pill>
      )}
      {row.learned && (
        <Pill background={COLORS.greenSoft} color={COLORS.greenDeep}>
          Learned
        </Pill>
      )}
    </span>
  );
}

function Ipa({ value }) {
  if (!value) return <span style={{ color: COLORS.mute }}>{EMPTY}</span>;
  return <span style={TEXT.ipa}>{value}</span>;
}

function categoryText(row) {
  return row?.tags?.length ? row.tags.join(' · ') : '';
}

function RowDetail({ row }) {
  const verbLines = formatVerb(row.verb, activePack.grammar);
  const facts = [
    row.plural && { label: 'Plural', value: row.plural },
    row.pos && { label: 'Part of speech', value: row.pos },
    ...verbLines.map((l) => ({ label: l.label, value: l.value })),
    row.antonyms.length > 0 && {
      label: activePack.grammar.labels.antonym,
      value: row.antonyms.join(', '),
    },
  ].filter(Boolean);

  return (
    <div style={{ padding: `${SPACE[3]}px ${SPACE[4]}px`, background: COLORS.paperDeep }}>
      {facts.length > 0 && (
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            gap: `${SPACE[1]}px ${SPACE[4]}px`,
            margin: 0,
            marginBottom: row.examples.length > 0 ? SPACE[3] : 0,
          }}
        >
          {facts.map((f) => (
            <div key={f.label} style={{ display: 'contents' }}>
              <dt
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.tag,
                  letterSpacing: LETTER_SPACING.caps,
                  color: COLORS.mute,
                }}
              >
                {f.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontFamily: FONTS.body,
                  fontSize: FONT_SIZE.sm,
                  color: COLORS.ink,
                  overflowWrap: 'anywhere',
                }}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {row.examples.length > 0 && (
        <div style={{ fontFamily: FONTS.body, fontSize: FONT_SIZE.sm }}>
          <div style={{ fontStyle: 'italic', color: COLORS.ink }}>{row.examples[0].de}</div>
          {row.examples[0].en && (
            <div style={{ color: COLORS.mute, marginTop: SPACE[1] }}>{row.examples[0].en}</div>
          )}
        </div>
      )}
      {facts.length === 0 && row.examples.length === 0 && (
        <div style={{ fontFamily: FONTS.body, fontSize: FONT_SIZE.sm, color: COLORS.mute }}>
          This card carries no extra detail. Generated decks ship a word, a translation and a
          pronunciation — nothing more.
        </div>
      )}
    </div>
  );
}

const th = {
  textAlign: 'left',
  padding: `${SPACE[2]}px ${SPACE[3]}px`,
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  letterSpacing: LETTER_SPACING.caps,
  color: COLORS.mute,
  fontWeight: FONT_WEIGHT.normal,
  borderBottom: `1px solid ${COLORS.border}`,
  whiteSpace: 'nowrap',
};

const td = {
  padding: `${SPACE[3]}px ${SPACE[3]}px`,
  fontFamily: FONTS.body,
  fontSize: FONT_SIZE.sm,
  color: COLORS.ink,
  verticalAlign: 'top',
  borderBottom: `1px solid ${COLORS.inkA12}`,
};

/**
 * Vocabulary rows for one page of one deck. Paging and search live in
 * VocabBrowser — this component renders the rows it is given.
 */
export default function VocabTable({
  rows = [],
  expandedId = null,
  onToggleExpand,
  onPractice,
  emptyMessage,
  mobile = false,
  caption,
}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div
        role="status"
        style={{
          padding: SPACE[8],
          textAlign: 'center',
          fontFamily: FONTS.mono,
          fontSize: FONT_SIZE.base,
          color: COLORS.mute,
          border: `1px dashed ${COLORS.border}`,
          borderRadius: RADIUS.lg,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  const expandLabel = (row) =>
    `${expandedId === row.id ? 'Hide' : 'Show'} details for ${row.display || row.word}`;
  const practiceLabel = (row) => `Practise ${row.display || row.word}`;
  const toggle = (id) => onToggleExpand?.(id);

  if (mobile) {
    return (
      <ul
        aria-label={caption}
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: SPACE[3] }}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              background: COLORS.card,
              overflow: 'hidden',
              minWidth: 0,
            }}
          >
            <div style={{ padding: SPACE[3], minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: FONT_SIZE.lg,
                  fontWeight: FONT_WEIGHT.semibold,
                  overflowWrap: 'anywhere',
                }}
              >
                {row.article ? `${row.article} ` : ''}
                {row.word}
              </div>
              <div style={{ color: COLORS.mute, fontSize: FONT_SIZE.sm, marginTop: SPACE[1] }}>
                {glossText(row) || EMPTY}
              </div>
              <div style={{ marginTop: SPACE[2] }}>
                <Ipa value={row.ipa} />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: SPACE[2],
                  alignItems: 'center',
                  marginTop: SPACE[2],
                }}
              >
                {row.level && (
                  <Pill background={COLORS.paperDeep} color={COLORS.mute}>
                    {row.level}
                  </Pill>
                )}
                {categoryText(row) && (
                  <Pill background={COLORS.paperDeep} color={COLORS.mute}>
                    {categoryText(row)}
                  </Pill>
                )}
                <StatusCell row={row} />
              </div>
              <div style={{ display: 'flex', gap: SPACE[2], marginTop: SPACE[3] }}>
                <button
                  type="button"
                  data-ui="button"
                  onClick={() => toggle(row.id)}
                  aria-expanded={expandedId === row.id}
                  aria-label={expandLabel(row)}
                  style={rowButton}
                >
                  Details
                </button>
                {onPractice && (
                  <button
                    type="button"
                    data-ui="button"
                    onClick={() => onPractice(row)}
                    aria-label={practiceLabel(row)}
                    style={rowButton}
                  >
                    Practise
                  </button>
                )}
              </div>
            </div>
            {expandedId === row.id && <RowDetail row={row} />}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div style={{ overflowX: 'auto', minWidth: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        {caption && (
          <caption
            style={{
              captionSide: 'top',
              textAlign: 'left',
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              paddingBottom: SPACE[2],
            }}
          >
            {caption}
          </caption>
        )}
        <thead>
          <tr>
            <th scope="col" style={{ ...th, width: 36 }}>
              <span style={visuallyHidden}>Details</span>
            </th>
            {['Term', 'Article', 'Meaning', 'IPA', 'Level', 'Category', 'Status'].map((h) => (
              <th key={h} scope="col" style={th}>
                {h}
              </th>
            ))}
            <th scope="col" style={th}>
              <span style={visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RowGroup
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              onToggleExpand={toggle}
              onPractice={onPractice}
              expandLabel={expandLabel}
              practiceLabel={practiceLabel}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({ row, expanded, onToggleExpand, onPractice, expandLabel, practiceLabel }) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <>
      <tr>
        <td style={{ ...td, textAlign: 'center' }}>
          <button
            type="button"
            data-ui="button"
            onClick={() => onToggleExpand(row.id)}
            aria-expanded={expanded}
            aria-label={expandLabel(row)}
            style={{ ...rowButton, padding: SPACE[1], lineHeight: 0 }}
          >
            <Chevron size={16} aria-hidden="true" />
          </button>
        </td>
        <th
          scope="row"
          style={{
            ...td,
            fontFamily: FONTS.display,
            fontWeight: FONT_WEIGHT.semibold,
            textAlign: 'left',
            overflowWrap: 'anywhere',
          }}
        >
          {row.word}
        </th>
        <td style={{ ...td, fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute }}>
          {row.article ?? EMPTY}
        </td>
        <td style={{ ...td, overflowWrap: 'anywhere' }}>{glossText(row) || EMPTY}</td>
        <td style={td}>
          <Ipa value={row.ipa} />
        </td>
        <td style={{ ...td, fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute }}>
          {row.level ?? EMPTY}
        </td>
        <td style={{ ...td, fontFamily: FONTS.mono, fontSize: FONT_SIZE.tag, color: COLORS.mute }}>
          {categoryText(row) || EMPTY}
        </td>
        <td style={td}>
          <StatusCell row={row} />
        </td>
        <td style={{ ...td, textAlign: 'right' }}>
          {onPractice && (
            <button
              type="button"
              data-ui="button"
              onClick={() => onPractice(row)}
              aria-label={practiceLabel(row)}
              style={rowButton}
            >
              Practise
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0, borderBottom: `1px solid ${COLORS.inkA12}` }}>
            <RowDetail row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

const rowButton = {
  padding: `${SPACE[1]}px ${SPACE[3]}px`,
  background: COLORS.surface,
  color: COLORS.ink,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.pill,
  fontFamily: FONTS.mono,
  fontSize: FONT_SIZE.tag,
  letterSpacing: LETTER_SPACING.caps,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

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
