import { Volume2 } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY } from '../../lib/theme';
import { speak } from '../../lib/speech';

// A single chat message — Anna's (gold, left) or the learner's (ink, right).
export default function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className="slide-up"
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.2em',
            color: COLORS.mute,
            marginBottom: 6,
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {isUser ? 'DU' : '— ANNA'}
        </div>
        <div
          style={{
            padding: '14px 18px',
            background: isUser ? COLORS.ink : COLORS.gold,
            color: COLORS.ink,
            border: `2px solid ${COLORS.ink}`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1.3,
              marginBottom: msg.ipa ? 6 : 0,
            }}
          >
            {msg.de}
            {!isUser && (
              <button
                onClick={() => speak(msg.de)}
                style={{
                  marginLeft: 10,
                  background: 'transparent',
                  border: 'none',
                  color: COLORS.red,
                  cursor: 'pointer',
                  verticalAlign: 'middle',
                }}
              >
                <Volume2 size={16} />
              </button>
            )}
          </div>
          {msg.ipa && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
              {msg.ipa}
            </div>
          )}
          {msg.en && (
            <div
              style={{
                fontFamily: FONT_BODY,
                fontStyle: 'italic',
                fontSize: 13,
                opacity: 0.75,
                borderTop: `1px solid ${isUser ? COLORS.paper + '30' : COLORS.ink + '30'}`,
                paddingTop: 6,
              }}
            >
              {msg.en}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
