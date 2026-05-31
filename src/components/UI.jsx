import { COLORS, FONT_DISPLAY, FONT_MONO, FONT_BODY } from '../lib/theme';

export function StatBlock({ label, value, icon, accent, pulsing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36,
        background: accent ? COLORS.gold : COLORS.ink,
        color: accent ? COLORS.ink : COLORS.card,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        animation: pulsing ? 'pulse-gold 2s infinite' : 'none',
      }}>{icon}</div>
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: '0.15em', color: COLORS.mute }}>{label}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}

export function SectionLabel({ num, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        background: COLORS.ink,
        color: COLORS.paper,
        padding: '2px 8px',
        letterSpacing: '0.1em',
      }}>{num}</span>
      <span style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color: COLORS.mute,
      }}>{text}</span>
    </div>
  );
}

export function Hero({ kicker, title, sub }) {
  return (
    <div style={{ borderBottom: `2px solid ${COLORS.ink}`, paddingBottom: 24 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: '0.3em', color: COLORS.red, marginBottom: 12, textTransform: 'uppercase' }}>
        {kicker}
      </div>
      <h1 style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 72,
        fontWeight: 900,
        margin: 0,
        letterSpacing: '-0.04em',
        lineHeight: 0.95,
      }}>
        {title}
      </h1>
      {sub && (
        <p style={{
          fontFamily: FONT_BODY,
          fontSize: 17,
          fontStyle: 'italic',
          color: COLORS.inkSoft,
          maxWidth: 600,
          marginTop: 16,
          lineHeight: 1.5,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export const btnSecondary = {
  flex: 1,
  padding: 14,
  background: COLORS.paper,
  color: COLORS.ink,
  border: `2px solid ${COLORS.ink}`,
  fontFamily: FONT_MONO,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.15em',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};
