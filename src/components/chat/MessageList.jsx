import { COLORS, FONT_MONO } from '../../lib/theme';
import MessageBubble from './MessageBubble';

// Scrollable conversation column: message bubbles + Anna's typing indicator.
// `endRef` is the parent's scroll anchor (kept in the parent so the scroll
// effect stays with the conversation state).
export default function MessageList({ messages, thinking, endRef }) {
  return (
    <div
      style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxHeight: 'calc(100vh - 400px)',
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
          <span>Anna tippt</span>
          <span style={{ animation: 'blink 1.4s infinite' }}>●</span>
          <span style={{ animation: 'blink 1.4s infinite 0.2s' }}>●</span>
          <span style={{ animation: 'blink 1.4s infinite 0.4s' }}>●</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
