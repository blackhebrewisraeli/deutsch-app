import { Volume2 } from 'lucide-react';
import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY, RADIUS, SHADOW } from '../../lib/theme';
import { speak } from '../../lib/speech';

// A single chat message — Anna's (gold, left, with avatar) or the learner's
// (ink, right).
export default function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className="slide-up"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: RADIUS.pill,
            background: COLORS.gold,
            boxShadow: SHADOW.press(COLORS.goldLipSoft),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🧑‍🏫
        </div>
      )}
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
            // Anna's bubble is the accent FILL, which is the same gold in both
            // modes — so its text must be accentOn, not the page fg. Using fg
            // here rendered near-white on gold in dark mode at 1.25:1.
            color: isUser ? COLORS.paper : COLORS.accentOn,
            borderRadius: isUser ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
            boxShadow: SHADOW.press(isUser ? COLORS.press : COLORS.goldLipSoft),
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
                type="button"
                onClick={() => speak(msg.de)}
                aria-label="Play Anna response audio"
                style={{
                  marginLeft: 10,
                  background: 'transparent',
                  border: 'none',
                  color: COLORS.red,
                  cursor: 'pointer',
                  verticalAlign: 'middle',
                }}
              >
                <Volume2 size={16} aria-hidden="true" />
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
                // Derived from the bubble's own text colour rather than a token:
                // the two bubbles have different foregrounds and both flip by
                // mode. Appending '30' to a token stopped working when colours
                // became CSS variables — `var(--c-fg)30` is not a colour.
                borderTop: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
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
