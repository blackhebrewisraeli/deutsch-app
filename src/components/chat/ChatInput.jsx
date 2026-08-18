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
        borderTop: `1px solid ${COLORS.border}`,
        padding: 16,
        display: 'flex',
        gap: 12,
        background: COLORS.paperDeep,
      }}
    >
      <button
        type="button"
        onClick={listening ? onStopListening : onStartListening}
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        style={{
          width: 56,
          height: 56,
          background: listening ? COLORS.red : COLORS.ink,
          color: COLORS.paper,
          border: 'none',
          borderRadius: RADIUS.md,
          boxShadow: SHADOW.press(listening ? COLORS.rust : COLORS.press),
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
        aria-label="Chat message in German"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSend()}
        placeholder={listening ? 'Sprich auf Deutsch...' : 'Schreib auf Deutsch...'}
        style={{
          flex: 1,
          minWidth: 0,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          boxShadow: SHADOW.inset,
          padding: '0 18px',
          fontFamily: FONT_BODY,
          fontSize: 16,
          color: COLORS.ink,
        }}
      />
      <button
        type="button"
        onClick={() => onSend()}
        disabled={!input.trim() || thinking}
        aria-label="Send chat message"
        style={{
          padding: '0 24px',
          background: input.trim() && !thinking ? COLORS.green : COLORS.mute,
          color: COLORS.paper,
          border: 'none',
          borderRadius: RADIUS.md,
          boxShadow: SHADOW.press(input.trim() && !thinking ? COLORS.greenDeep : COLORS.muteDeep),
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.15em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        SEND <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
