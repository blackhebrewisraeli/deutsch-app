import { COLORS, FONT_MONO, SPACE } from '../../lib/theme';
import MessageBubble from './MessageBubble';
import { activePack } from '../../packs';

// Scrollable conversation column: message bubbles + the tutor's typing indicator.
// `endRef` is the parent's scroll anchor (kept in the parent so the scroll
// effect stays with the conversation state).
export default function MessageList({ messages, thinking, endRef, compact = false }) {
  return (
    <div
      style={{
        flex: 1,
        padding: compact ? SPACE[4] : SPACE[6],
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? SPACE[4] : SPACE[5],
        maxHeight: 'calc(100vh - 400px)',
        minWidth: 0,
      }}
    >
      {messages.map((m, i) => (
        <MessageBubble key={i} msg={m} />
      ))}
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
          {/* KNOWN GAP: the persona name is pack-owned but "tippt" stays
              German. That is UI-chrome localisation, a separate problem this
              phase has no answer for. */}
          <span>{activePack.prompts.persona} tippt</span>
          <span style={{ animation: 'blink 1.4s infinite' }}>●</span>
          <span style={{ animation: 'blink 1.4s infinite 0.2s' }}>●</span>
          <span style={{ animation: 'blink 1.4s infinite 0.4s' }}>●</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
