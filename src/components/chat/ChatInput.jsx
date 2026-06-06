import { Mic, MicOff, ArrowRight } from 'lucide-react';
import { COLORS, FONT_BODY, FONT_MONO } from '../../lib/theme';

// Bottom input bar: mic toggle, text field, send button.
// All behavior (speech recognition, sending) lives in the parent and is passed
// in as callbacks — this component is presentational.
export default function ChatInput({
  input,
  setInput,
  listening,
  thinking,
  onSend,
  onStartListening,
  onStopListening,
}) {
  return (
    <div
      style={{
        borderTop: `2px solid ${COLORS.ink}`,
        padding: 16,
        display: 'flex',
        gap: 12,
        background: COLORS.paperDeep,
      }}
    >
      <button
        onClick={listening ? onStopListening : onStartListening}
        style={{
          width: 56,
          height: 56,
          background: listening ? COLORS.red : COLORS.ink,
          color: COLORS.paper,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: listening ? 'pulse-red 1.2s infinite' : 'none',
          flexShrink: 0,
        }}
      >
        {listening ? <MicOff size={22} /> : <Mic size={22} />}
      </button>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSend()}
        placeholder={listening ? 'Sprich auf Deutsch...' : 'Schreib auf Deutsch...'}
        style={{
          flex: 1,
          background: COLORS.paper,
          border: `2px solid ${COLORS.ink}`,
          padding: '0 16px',
          fontFamily: FONT_BODY,
          fontSize: 16,
          outline: 'none',
          color: COLORS.ink,
        }}
      />
      <button
        onClick={() => onSend()}
        disabled={!input.trim() || thinking}
        style={{
          padding: '0 24px',
          background: input.trim() && !thinking ? COLORS.red : COLORS.mute,
          color: COLORS.paper,
          border: 'none',
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.15em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        SEND <ArrowRight size={14} />
      </button>
    </div>
  );
}
