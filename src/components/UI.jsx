import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE,
         BORDER, BUTTON, TEXT } from '../lib/theme';

// Re-export btnSecondary so existing component imports keep working
export { btnSecondary } from '../lib/theme';

// ── StatBlock ─────────────────────────────────────────────────
// Header stat pill: streak counter, learned word count.
export function StatBlock({ label, value, icon, accent, pulsing }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] + 2 }}>
      <div style={{
        width: 36, height: 36,
        background:  accent ? COLORS.gold : COLORS.ink,
        color:       accent ? COLORS.ink  : COLORS.card,
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        flexShrink:  0,
        animation:   pulsing ? 'pulse-gold 2s infinite' : 'none',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ ...TEXT.label, letterSpacing: LETTER_SPACING.widest }}>
          {label}
        </div>
        <div style={{
          fontFamily:  FONTS.display,
          fontSize:    22,
          fontWeight:  FONT_WEIGHT.bold,
          lineHeight:  1,
          color:       COLORS.ink,
        }}>
          {value}
        </div>
      </div>
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────
// Small labelled section header: [A] SCENARIO, [B] CORRECTION, etc.
export function SectionLabel({ num, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[2] + 2, marginBottom: SPACE[3] }}>
      <span style={{ ...TEXT.tag }}>{num}</span>
      <span style={{
        ...TEXT.label,
        letterSpacing: LETTER_SPACING.ultra,
      }}>
        {text}
      </span>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────
// Full-width section title block: kicker + big heading + subtitle.
export function Hero({ kicker, title, sub }) {
  return (
    <div style={{ borderBottom: BORDER.standard, paddingBottom: SPACE[6] }}>
      <div style={{ ...TEXT.kicker, marginBottom: SPACE[3] }}>
        {kicker}
      </div>
      <h1 style={{
        ...TEXT.display,
        fontSize:   72,
        margin:     0,
        lineHeight: 0.95,
      }}>
        {title}
      </h1>
      {sub && (
        <p style={{
          fontFamily:  FONTS.body,
          fontSize:    FONT_SIZE.md + 2,
          fontStyle:   'italic',
          color:       COLORS.inkSoft,
          maxWidth:    600,
          marginTop:   SPACE[4],
          lineHeight:  1.5,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}
