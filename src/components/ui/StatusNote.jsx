import { SPACE } from '../../lib/theme';
import { Stack } from './Layout';
import { Body } from './Text';
import Button from './Button';
import { TONE } from './tone';

// A note about a region's status. Not "EmptyState": half its call sites are
// errors, and a name that covers half the uses is how the family drifted apart
// in the first place (docs/status-states-spec.md §2).
//
// This composes and does not re-derive. It sets no font family, no font size,
// no line height — Body owns those — and no button styling, which Button owns.
// Its entire contribution is the arrangement, the tone, and the live region.

// StatusNote tone -> text tone. Two vocabularies on purpose: "empty" describes
// the SITUATION, "muted" describes the INK, and they are not the same idea.
const TEXT_TONE = { empty: 'muted', error: 'error' };

// Block-level statement, not an inline glyph. The app's inline icons are 14-16;
// 32 has existing precedent here for standalone marks.
const ICON_SIZE = 32;

export default function StatusNote({
  tone = 'empty',
  icon: Icon,
  action,
  as = 'div',
  style,
  children,
  ...rest
}) {
  // A warning rather than a throw, matching Button's icon-without-label
  // precedent: crashing a production screen over a missing glyph makes the
  // defect worse, not better. The paired test is what stops one landing.
  if (!Icon) {
    console.error('StatusNote: `icon` is required — see docs/status-states-spec.md §4.4.');
  }

  const isError = tone === 'error';
  const textTone = TEXT_TONE[tone] ?? TEXT_TONE.empty;

  return (
    <Stack
      as={as}
      gap={3}
      align="center"
      data-ui="status-note"
      data-tone={tone}
      // Only errors announce. An empty state is present on first paint, so a
      // live region would interrupt for a non-event.
      role={isError ? 'alert' : undefined}
      style={{
        padding: SPACE[6],
        textAlign: 'center',
        // The ink lives on the root so the icon can inherit it via
        // currentColor. One decision, not two, and the glyph cannot drift out
        // of contrast independently of its text.
        color: TONE[textTone],
        ...style,
      }}
      {...rest}
    >
      {Icon && <Icon size={ICON_SIZE} aria-hidden="true" color="currentColor" />}
      <Body
        size="sm"
        tone={textTone}
        // Italic is the hush an absent-content note wants, and is what the two
        // existing empty states already ship. Errors stay upright.
        style={isError ? undefined : { fontStyle: 'italic' }}
      >
        {children}
      </Body>
      {/* No `size` prop: Button only honours size for variant="icon", so
          passing it here would read as meaningful and do nothing. */}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Stack>
  );
}
