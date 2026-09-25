import { COLORS, FONT_MONO, SPACE } from '../../lib/theme';
import MessageBubble from './MessageBubble';
import { activePack } from '../../packs';

// Scrollable conversation column: message bubbles + the tutor's typing indicator.
// `endRef` is the parent's scroll anchor (kept in the parent so the scroll
// effect stays with the conversation state).
export default function MessageList({
  messages,
  thinking,
  endRef,
  compact = false,
  speaker = activePack.prompts.persona,
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: compact ? SPACE[4] : SPACE[6],
        overflowY: compact ? 'visible' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? SPACE[4] : SPACE[5],
        // Desktop keeps an inner pane so the composer stays in view. Compact
        // (narrow) lets the thread grow with the page — 100vh − 400px left a
        // ~168px scroller at 320×568 and hid the turn that was just graded.
        maxHeight: compact ? 'none' : 'calc(100vh - 400px)',
        minWidth: 0,
      }}
    >
      {/* A hidden turn is stage direction for the model (the scene kickoff);
          it stays in history but never in the thread. */}
      {messages.map((m, i) =>
        m.hidden ? null : <MessageBubble key={i} msg={m} speaker={speaker} />
      )}
      {thinking && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: COLORS.mute,
            fontFamily: FONT_MONO,
            fontSize: 12,
          }}
        >
          {/* KNOWN GAP: the speaker name is pack-owned but "tippt" stays
              German. That is UI-chrome localisation, a separate problem this
              phase has no answer for. */}
          <span>{speaker} tippt</span>
          <span style={{ animation: 'blink 1.4s infinite' }}>●</span>
          <span style={{ animation: 'blink 1.4s infinite 0.2s' }}>●</span>
          <span style={{ animation: 'blink 1.4s infinite 0.4s' }}>●</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
