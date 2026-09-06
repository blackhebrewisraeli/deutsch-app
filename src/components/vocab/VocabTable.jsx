import {
  BORDER,
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  RADIUS,
  SPACE,
  TEXT,
} from '../../lib/theme';
import { BROWSE_PAGE_SIZE, statusForCard } from './vocabStatus';

const STATUS_LABEL = {
  new: 'New',
  due: 'Due',
  learned: 'Learned',
  mastered: 'Mastered',
};

const STATUS_INK = {
  new: COLORS.mute,
  due: COLORS.accentRed,
  learned: COLORS.green,
  mastered: COLORS.ink,
};

function StatusPill({ status }) {
  return (
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.caps,
        textTransform: 'uppercase',
        color: STATUS_INK[status] ?? COLORS.mute,
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Ipa({ value }) {
  if (!value) return <span style={{ color: COLORS.mute }}>—</span>;
  return <span style={TEXT.ipa}>{value}</span>;
}

function Term({ children }) {
  return (
    <span
      style={{
        fontFamily: FONTS.display,
        fontWeight: FONT_WEIGHT.semibold,
        fontSize: FONT_SIZE.md,
        overflowWrap: 'anywhere',
        minWidth: 0,
      }}
    >
      {children}
    </span>
  );
}

/**
 * View-only vocabulary rows for one deck. Caps at BROWSE_PAGE_SIZE so a
 * Top 500 auto deck cannot mount 500 rows on a phone.
 */
export default function VocabTable({
  cards = [],
  deckId,
  srs = {},
  now = Date.now(),
  mobile = false,
  caption,
}) {
  const total = Array.isArray(cards) ? cards.length : 0;
  const rows = (cards ?? []).slice(0, BROWSE_PAGE_SIZE);
  const capped = total > BROWSE_PAGE_SIZE;

  if (total === 0) return null;

  const statusOf = (card) => statusForCard({ card, deckId, srs, now });

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {capped && (
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
            marginBottom: SPACE[3],
          }}
        >
          Showing {BROWSE_PAGE_SIZE} of {total}
        </div>
      )}
      {mobile ? (
        <ul
          aria-label={caption}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE[3],
            minWidth: 0,
          }}
        >
          {rows.map((card) => (
            <li
              key={card.id}
              style={{
                border: BORDER.panel,
                borderRadius: RADIUS.lg,
                padding: SPACE[4],
                background: COLORS.surface,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: SPACE[2],
                minWidth: 0,
              }}
            >
              <Term>{card.de}</Term>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: FONT_SIZE.base,
                  overflowWrap: 'anywhere',
                }}
              >
                {card.en}
              </span>
              <Ipa value={card.ipa} />
              <StatusPill status={statusOf(card)} />
            </li>
          ))}
        </ul>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 0,
            position: 'relative',
          }}
        >
          {caption && (
            <caption
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              {caption}
            </caption>
          )}
          <thead>
            <tr>
              {['Term', 'Meaning', 'IPA', 'Status'].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{
                    ...TEXT.label,
                    textAlign: 'start',
                    padding: `${SPACE[2]}px ${SPACE[3]}px`,
                    borderBottom: BORDER.panel,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((card) => (
              <tr key={card.id}>
                <td style={{ padding: `${SPACE[3]}px`, borderBottom: BORDER.panel, minWidth: 0 }}>
                  <Term>{card.de}</Term>
                </td>
                <td
                  style={{
                    padding: `${SPACE[3]}px`,
                    borderBottom: BORDER.panel,
                    fontFamily: FONTS.body,
                    fontSize: FONT_SIZE.base,
                    overflowWrap: 'anywhere',
                    minWidth: 0,
                  }}
                >
                  {card.en}
                </td>
                <td style={{ padding: `${SPACE[3]}px`, borderBottom: BORDER.panel }}>
                  <Ipa value={card.ipa} />
                </td>
                <td style={{ padding: `${SPACE[3]}px`, borderBottom: BORDER.panel }}>
                  <StatusPill status={statusOf(card)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
