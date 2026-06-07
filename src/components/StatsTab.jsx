import { useState, useEffect } from 'react';
import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../lib/theme';
import { loadState } from '../lib/storage';
import {
  TABS,
  LEVELS,
  todayKey,
  getTodaySnapshot,
  getHeatmapData,
  getPerTabBreakdown,
  getAccuracyByLevel,
  getReviewItems,
} from '../lib/stats';
import { getDueCount, getMasteredCount, srsKey, MASTERED_BOX } from '../lib/srs';
import { PRESET_DECKS } from '../data/content';
import { Hero, SectionLabel } from './UI';

const DECK_LABELS = {
  greetings: 'Greetings',
  food: 'Food & Drink',
  travel: 'Travel',
  numbers: 'Numbers',
};

// ─── Intensity palette (heatmap squares) ──────────────────────
const INTENSITY_COLORS = [
  COLORS.paperDeep, // 0 — no activity
  '#F5C51840', // 1 — 1–3 events  (gold 25%)
  '#F5C51890', // 2 — 4–9 events  (gold 56%)
  COLORS.gold, // 3 — 10–19 events
  COLORS.red, // 4 — 20+ events
];

const TAB_LABELS = {
  chat: '01 Chat',
  alphabet: '02 Alphabet',
  vocab: '03 Vocab',
  translate: '04 Translate',
};

const LEVEL_LABELS = { a1: 'A1', a2: 'A2', b1: 'B1' };

// Map a stored item back to a short badge for the Review feed.
const REVIEW_BADGE = {
  alphabet: 'ALPHABET',
  vocab: 'VOCAB',
  translate: 'TRANSLATE',
};

// ─── Today snapshot ───────────────────────────────────────────

function TodaySnapshot({ snap }) {
  const { exercises, accuracy, streak } = snap;
  const totalGraded = accuracy.correct + accuracy.almost + accuracy.wrong;
  const pct = (n) => (totalGraded === 0 ? 0 : Math.round((n / totalGraded) * 100));

  return (
    <div
      style={{
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        background: COLORS.card,
        padding: SPACE[6],
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: SPACE[8],
        alignItems: 'center',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
            marginBottom: SPACE[2],
          }}
        >
          TODAY
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: FONT_SIZE['6xl'],
            fontWeight: FONT_WEIGHT.black,
            letterSpacing: LETTER_SPACING.tight,
            lineHeight: 1,
            color: COLORS.ink,
          }}
        >
          {exercises}
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontStyle: 'italic',
            fontSize: FONT_SIZE.base,
            color: COLORS.mute,
            marginTop: SPACE[2],
          }}
        >
          exercise{exercises === 1 ? '' : 's'}
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            color: COLORS.mute,
            marginBottom: SPACE[3],
          }}
        >
          ACCURACY · STREAK {streak}
        </div>
        {totalGraded === 0 ? (
          <div
            style={{
              fontFamily: FONTS.body,
              fontStyle: 'italic',
              color: COLORS.mute,
              fontSize: FONT_SIZE.base,
            }}
          >
            No exercises graded yet today.
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                height: 24,
                borderRadius: RADIUS.pill,
                overflow: 'hidden',
                marginBottom: SPACE[2],
              }}
            >
              {accuracy.correct > 0 && (
                <div style={{ width: `${pct(accuracy.correct)}%`, background: COLORS.gold }} />
              )}
              {accuracy.almost > 0 && (
                <div style={{ width: `${pct(accuracy.almost)}%`, background: COLORS.paperDeep }} />
              )}
              {accuracy.wrong > 0 && (
                <div style={{ width: `${pct(accuracy.wrong)}%`, background: COLORS.red }} />
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: SPACE[5],
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                color: COLORS.ink,
              }}
            >
              <span>
                ✓ {accuracy.correct} ({pct(accuracy.correct)}%)
              </span>
              <span>
                ≈ {accuracy.almost} ({pct(accuracy.almost)}%)
              </span>
              <span>
                ✗ {accuracy.wrong} ({pct(accuracy.wrong)}%)
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────

function Heatmap({ data, mobile }) {
  // Slice into weeks (Sun–Sat columns).
  // data is in chronological order ending at today, so we need to offset by today's weekday.
  const cellSize = mobile ? 9 : 12;
  const gap = 2;

  // Total cells = 7 rows × N weeks. We render in row-major order:
  // grid-auto-flow: column means each column fills top to bottom.
  const weeks = Math.ceil(data.length / 7);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(7, ${cellSize}px)`,
        gridAutoFlow: 'column',
        gridAutoColumns: `${cellSize}px`,
        gap,
        overflowX: 'auto',
        paddingBottom: SPACE[2],
        maxWidth: '100%',
      }}
    >
      {data.map((day) => (
        <div
          key={day.date}
          title={`${day.date} · ${day.total} exercise${day.total === 1 ? '' : 's'}`}
          style={{
            width: cellSize,
            height: cellSize,
            background: INTENSITY_COLORS[day.intensity],
            border: `1px solid ${COLORS.ink}20`,
          }}
        />
      ))}
      {/* Total cells to fill the grid to a full week column if data doesn't align */}
      {data.length < weeks * 7 &&
        Array.from({ length: weeks * 7 - data.length }).map((_, i) => (
          <div
            key={`pad-${i}`}
            style={{
              width: cellSize,
              height: cellSize,
              background: 'transparent',
            }}
          />
        ))}
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[2],
        marginTop: SPACE[3],
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        letterSpacing: LETTER_SPACING.caps,
        color: COLORS.mute,
      }}
    >
      <span>LESS</span>
      {INTENSITY_COLORS.map((c, i) => (
        <span
          key={i}
          style={{
            width: 10,
            height: 10,
            background: c,
            border: `1px solid ${COLORS.ink}20`,
          }}
        />
      ))}
      <span>MORE</span>
    </div>
  );
}

// ─── Per-tab breakdown ────────────────────────────────────────

function PerTabBars({ breakdown }) {
  const max = Math.max(...Object.values(breakdown), 1);
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div
        style={{
          fontFamily: FONTS.body,
          fontStyle: 'italic',
          color: COLORS.mute,
          fontSize: FONT_SIZE.base,
        }}
      >
        No exercises recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
      {TABS.map((tab) => {
        const count = breakdown[tab];
        const pct = Math.round((count / max) * 100);
        return (
          <div key={tab}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: SPACE[1],
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                color: COLORS.ink,
              }}
            >
              <span style={{ letterSpacing: LETTER_SPACING.caps }}>{TAB_LABELS[tab]}</span>
              <span style={{ color: COLORS.mute }}>
                {count} ({total === 0 ? 0 : Math.round((count / total) * 100)}%)
              </span>
            </div>
            <div
              style={{
                height: 14,
                borderRadius: RADIUS.pill,
                background: COLORS.paperDeep,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: count === max ? COLORS.red : COLORS.ink,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Accuracy by level (three-way stacked) ────────────────────

function AccuracyByLevel({ byLevel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
      {LEVELS.map((level) => {
        const { correct, almost, wrong } = byLevel[level];
        const total = correct + almost + wrong;
        const pct = (n) => (total === 0 ? 0 : (n / total) * 100);
        return (
          <div key={level}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: SPACE[1],
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.sm,
                color: COLORS.ink,
              }}
            >
              <span style={{ letterSpacing: LETTER_SPACING.caps }}>{LEVEL_LABELS[level]}</span>
              <span style={{ color: COLORS.mute }}>
                {total === 0
                  ? 'no data'
                  : `${correct + almost} of ${total} (${Math.round(pct(correct + almost))}%)`}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                height: 14,
                borderRadius: RADIUS.pill,
                background: COLORS.paperDeep,
                overflow: 'hidden',
              }}
            >
              {total === 0 ? null : (
                <>
                  {correct > 0 && (
                    <div style={{ width: `${pct(correct)}%`, background: COLORS.gold }} />
                  )}
                  {almost > 0 && (
                    <div style={{ width: `${pct(almost)}%`, background: COLORS.paperDeep }} />
                  )}
                  {wrong > 0 && <div style={{ width: `${pct(wrong)}%`, background: COLORS.red }} />}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Review feed ──────────────────────────────────────────────

function ReviewFeed({ items, onReview }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          fontFamily: FONTS.body,
          fontStyle: 'italic',
          color: COLORS.mute,
          fontSize: FONT_SIZE.base,
        }}
      >
        Nothing to review — keep practicing.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.card,
        overflow: 'hidden',
      }}
    >
      {items.map((item, i) => {
        const verdictColor = item.lastVerdict === 'almost' ? COLORS.mute : COLORS.red;
        const verdictGlyph = item.lastVerdict === 'almost' ? '≈' : '✗';
        const context = item.context ? ` · ${item.context.toUpperCase()}` : '';
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onReview(item)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: SPACE[4],
              alignItems: 'center',
              textAlign: 'left',
              padding: `${SPACE[3]}px ${SPACE[4]}px`,
              background: COLORS.paper,
              border: 'none',
              borderBottom: i < items.length - 1 ? `1px solid ${COLORS.ink}10` : 'none',
              cursor: 'pointer',
              transition: 'background 0.12s ease',
              color: COLORS.ink,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.paperDeep)}
            onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.paper)}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                color: COLORS.mute,
                whiteSpace: 'nowrap',
              }}
            >
              {REVIEW_BADGE[item.tab]}
              {context}
            </span>

            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: FONT_SIZE.lg,
                  fontWeight: FONT_WEIGHT.semibold,
                  color: COLORS.ink,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontStyle: 'italic',
                  fontSize: FONT_SIZE.base,
                  color: COLORS.mute,
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.detail}
              </span>
            </span>

            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: FONT_SIZE.tag,
                letterSpacing: LETTER_SPACING.caps,
                color: verdictColor,
                whiteSpace: 'nowrap',
              }}
            >
              {verdictGlyph} {item.wrongCount}×
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Vocab SRS widget ─────────────────────────────────────────

function VocabSrsWidget({ srs, now }) {
  const dueTotal = getDueCount(srs, PRESET_DECKS, now);
  const masteredTotal = getMasteredCount(srs);
  const cardTotal = Object.values(PRESET_DECKS).reduce((sum, deck) => sum + deck.length, 0);

  return (
    <div>
      <div
        style={{
          borderRadius: RADIUS.lg,
          boxShadow: SHADOW.card,
          background: COLORS.card,
          padding: SPACE[6],
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: SPACE[8],
          alignItems: 'center',
          marginBottom: SPACE[4],
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[2],
            }}
          >
            DUE NOW
          </div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: FONT_SIZE['6xl'],
              fontWeight: FONT_WEIGHT.black,
              letterSpacing: LETTER_SPACING.tight,
              lineHeight: 1,
              color: dueTotal > 0 ? COLORS.red : COLORS.ink,
            }}
          >
            {dueTotal}
          </div>
          <div
            style={{
              fontFamily: FONTS.body,
              fontStyle: 'italic',
              fontSize: FONT_SIZE.base,
              color: COLORS.mute,
              marginTop: SPACE[2],
            }}
          >
            card{dueTotal === 1 ? '' : 's'}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: FONT_SIZE.tag,
              letterSpacing: LETTER_SPACING.caps,
              color: COLORS.mute,
              marginBottom: SPACE[3],
            }}
          >
            MASTERED · {masteredTotal} OF {cardTotal}
          </div>
          <div
            style={{
              height: 24,
              borderRadius: RADIUS.pill,
              background: COLORS.paperDeep,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${cardTotal === 0 ? 0 : (masteredTotal / cardTotal) * 100}%`,
                height: '100%',
                background: COLORS.gold,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
        {Object.keys(PRESET_DECKS).map((deckId) => {
          const deck = PRESET_DECKS[deckId];
          let mastered = 0;
          let due = 0;
          for (const card of deck) {
            const entry = srs[srsKey(deckId, card.de)];
            if (entry?.box === MASTERED_BOX) mastered += 1;
            if (!entry || entry.nextDue <= now) due += 1;
          }
          const masteredPct = Math.round((mastered / deck.length) * 100);
          return (
            <div key={deckId}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: SPACE[1],
                  fontFamily: FONTS.mono,
                  fontSize: FONT_SIZE.sm,
                  color: COLORS.ink,
                }}
              >
                <span style={{ letterSpacing: LETTER_SPACING.caps }}>
                  {DECK_LABELS[deckId]?.toUpperCase() ?? deckId.toUpperCase()}
                </span>
                <span style={{ color: COLORS.mute }}>
                  {mastered}/{deck.length} mastered{due > 0 ? ` · ${due} due` : ''}
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: RADIUS.pill,
                  background: COLORS.paperDeep,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${masteredPct}%`,
                    height: '100%',
                    background: COLORS.gold,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export default function StatsTab({ mobile = false, onReview }) {
  // Pull state from storage every time the tab renders so today's counters
  // reflect events from the other tabs without app-wide state plumbing.
  const [state, setState] = useState(() => loadState() ?? {});

  // Re-read on focus so switching tabs picks up new events.
  useEffect(() => {
    const onFocus = () => setState(loadState() ?? {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const daily = state.daily ?? {};
  const items = state.items ?? {};
  const srs = state.srs ?? {};
  const stats = state.stats ?? { streak: 0, learnedCount: 0 };

  const today = todayKey();
  const nowMs = Date.now();
  const snap = getTodaySnapshot(daily, stats, today);
  const heatmap = getHeatmapData(daily, new Date(), 365);
  const perTab = getPerTabBreakdown(daily);
  const accByLevel = getAccuracyByLevel(daily);
  const review = getReviewItems(items, 10);

  return (
    <div>
      <Hero
        kicker="Section 05"
        title="Statistik"
        sub="A picture of your practice. Today's snapshot, the year so far, and how your effort breaks down across the four sections."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[8], marginTop: SPACE[8] }}>
        <section>
          <SectionLabel num="A" text="Today" />
          <TodaySnapshot snap={snap} />
        </section>

        <section>
          <SectionLabel num="B" text="Last 12 months" />
          <Heatmap data={heatmap} mobile={mobile} />
          <HeatmapLegend />
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
            gap: SPACE[8],
          }}
        >
          <section>
            <SectionLabel num="C" text="By section" />
            <PerTabBars breakdown={perTab} />
          </section>

          <section>
            <SectionLabel num="D" text="Accuracy by level" />
            <AccuracyByLevel byLevel={accByLevel} />
          </section>
        </div>

        <section>
          <SectionLabel num="E" text="Review — tap to re-attempt" />
          <ReviewFeed items={review} onReview={onReview ?? (() => {})} />
        </section>

        <section>
          <SectionLabel num="F" text="Vocab review queue" />
          <VocabSrsWidget srs={srs} now={nowMs} />
        </section>
      </div>
    </div>
  );
}
