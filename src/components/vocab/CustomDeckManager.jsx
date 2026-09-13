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
} from '../../lib/theme';
import SectionLabel from '../ui/SectionLabel';

// Same column the Practice picker uses — a full-bleed generate button on a
// 1280px screen is a different control than the one this form moved from.
const MANAGER_MAX_WIDTH = 448;

export const CUSTOM_SCOPE_LABEL = 'Your decks';
export const CUSTOM_EMPTY_COPY = 'No custom decks yet. Type a topic below to generate one.';

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * Custom-tab management surface: the live custom decks (select + trash + the
 * #255/#257 confirm) and the generate form. Practice's DeckPicker is
 * select-only; Browse stays view-only. No new storage or sync contracts —
 * VocabTab still owns generateDeck / onDeckDeleted.
 *
 * @param {{ deckId: string, onSelect: (id: string) => void,
 *           customDecks?: object, customTopic: string,
 *           onTopicChange: (t: string) => void, generating: boolean,
 *           onGenerate: () => void, onDelete?: (id: string) => void,
 *           atCap?: boolean, maxDecks?: number, mobile?: boolean }} props
 */
export default function CustomDeckManager({
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
  mobile = false,
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

  const entries = Object.entries(customDecks);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: MANAGER_MAX_WIDTH,
        marginLeft: 'auto',
        marginRight: 'auto',
        minWidth: 0,
        boxSizing: 'border-box',
        marginTop: mobile ? SPACE[4] : SPACE[6],
      }}
    >
      <SectionLabel style={{ marginBottom: SPACE[2] }}>{CUSTOM_SCOPE_LABEL}</SectionLabel>
      {entries.length === 0 ? (
        <p
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.base,
            color: COLORS.mute,
            margin: `0 0 ${SPACE[5]}px`,
          }}
        >
          {CUSTOM_EMPTY_COPY}
        </p>
      ) : (
        <div
          style={{
            borderRadius: RADIUS.lg,
            border: BORDER.panel,
            overflow: 'hidden',
            marginBottom: SPACE[5],
            minWidth: 0,
          }}
        >
          {entries.map(([id, deck], row, rows) => {
            const deckName = deck.name || 'Your Deck';
            const pending = pendingDeleteId === id;
            const selected = deckId === id;
            const count = deck.cards?.length ?? 0;

            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  borderTop: row === 0 ? 'none' : `1px solid ${COLORS.inkA12}`,
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
                      padding: mobile ? '10px 12px' : '14px 16px',
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
                      aria-label={`Your Deck: ${deck.name || 'unnamed'} — ${count} ${plural(count, 'card', 'cards')}`}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: mobile ? '10px 12px' : '14px 16px',
                        background: 'transparent',
                        color: selected ? COLORS.paper : COLORS.ink,
                        border: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: FONTS.display,
                        fontSize: mobile ? FONT_SIZE.md : FONT_SIZE.lg,
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
                      <span
                        style={{ fontFamily: FONTS.mono, fontSize: FONT_SIZE.ipa, opacity: 0.7 }}
                      >
                        {count} {plural(count, 'card', 'cards')}
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
                          padding: mobile ? '10px 12px' : '14px 16px',
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
      )}

      <SectionLabel>Generate Custom</SectionLabel>
      <div
        style={{
          borderRadius: RADIUS.lg,
          border: BORDER.panel,
          padding: SPACE[4],
          background: COLORS.paperDeep,
          minWidth: 0,
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
          type="button"
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
    </div>
  );
}
