import {
  COLORS,
  FONTS,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  SPACE,
  RADIUS,
  SHADOW,
} from '../lib/theme';
import {
  AUTO_MODEL,
  MODEL_PREFERENCES,
  sanitizePreferredModel,
  preferenceOption,
} from '../lib/ai-routing/preference.js';
import { routeAiRequest } from '../lib/ai-routing/router.js';

/**
 * 2×2 picker for Auto / Fast / Balanced / Capable. Shared by Settings and Chat
 * so the same preference has one control. Grid tracks are minmax(0, 1fr) so
 * four uppercase labels still shrink at 320px.
 */
export default function ModelPicker({
  value,
  onChange,
  userTier = 'guest',
  compact = false,
  ariaLabel = 'Chat model',
}) {
  const preferred = sanitizePreferredModel(value);
  const routed = routeAiRequest({
    taskType: 'chat',
    userTier,
    preferredModel: preferred,
  });
  const fallingBack = preferred !== AUTO_MODEL && routed.profile !== preferred;
  const used = preferenceOption(routed.profile);

  return (
    <div>
      <div
        role="group"
        aria-label={ariaLabel}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: SPACE[3],
        }}
      >
        {MODEL_PREFERENCES.map((option) => {
          const active = option.id === preferred;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange?.(option.id)}
              style={{
                border: 'none',
                borderRadius: RADIUS.md,
                boxShadow: SHADOW.press(active ? COLORS.greenDeep : COLORS.lip),
                background: active ? COLORS.green : COLORS.card,
                color: active ? COLORS.paper : COLORS.ink,
                padding: compact ? SPACE[3] : SPACE[4],
                cursor: 'pointer',
                fontFamily: FONTS.mono,
                textAlign: 'center',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontWeight: FONT_WEIGHT.bold,
                  letterSpacing: compact ? LETTER_SPACING.wider : LETTER_SPACING.widest,
                  fontSize: compact ? FONT_SIZE.tag : FONT_SIZE.sm,
                  textTransform: 'uppercase',
                  overflowWrap: 'anywhere',
                }}
              >
                {option.label}
              </div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: FONT_SIZE.tag,
                  fontWeight: FONT_WEIGHT.medium,
                  letterSpacing: LETTER_SPACING.normal,
                  textTransform: 'none',
                  marginTop: SPACE[1],
                  overflowWrap: 'anywhere',
                  opacity: 0.85,
                }}
              >
                {option.detail}
              </div>
            </button>
          );
        })}
      </div>
      {fallingBack && (
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: FONT_SIZE.sm,
            color: COLORS.inkSoft,
            overflowWrap: 'anywhere',
            marginTop: SPACE[3],
          }}
        >
          This pick is above your current plan, so Chat uses {used.label} instead.
        </div>
      )}
    </div>
  );
}
