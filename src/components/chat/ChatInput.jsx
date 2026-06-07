import { Mic, MicOff, ArrowRight } from 'lucide-react';
import { COLORS, FONT_BODY, FONT_MONO, RADIUS, SHADOW } from '../../lib/theme';

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
        borderTop: `1px solid ${COLORS.ink}12`,
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
          borderRadius: RADIUS.md,
          boxShadow: SHADOW.press(listening ? COLORS.rust : '#000000'),
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
          background: COLORS.card,
          border: 'none',
          borderRadius: RADIUS.md,
          boxShadow: 'inset 0 2px 5px rgba(22,17,11,0.06)',
          padding: '0 18px',
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
          background: input.trim() && !thinking ? COLORS.green : COLORS.mute,
          color: COLORS.paper,
          border: 'none',
          borderRadius: RADIUS.md,
          boxShadow: SHADOW.press(input.trim() && !thinking ? COLORS.greenDeep : '#6b6354'),
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
