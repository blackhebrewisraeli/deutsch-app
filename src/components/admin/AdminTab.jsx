import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../../lib/theme';
import Heading from '../ui/Heading';
import Surface from '../ui/Surface';
import AdminSection from './AdminSection';

/**
 * The Admin tab.
 *
 * ONE surface, not a surface per section. The panel used to nest a card inside
 * a card inside a card — page Surface, then a Surface per list row — and the
 * nesting is what made the tab read as clutter rather than as a tool. Elevation
 * now changes exactly once, at the page's own plane; everything inside is
 * separated by hairlines and whitespace.
 */
export default function AdminTab({ me }) {
  if (!me?.isAdmin) return null;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: SPACE[5] }}>
        <Heading
          level={1}
          size="xl"
          style={{
            fontFamily: FONTS.body,
            fontWeight: FONT_WEIGHT.bold,
            letterSpacing: LETTER_SPACING.tight,
            marginBottom: SPACE[1],
          }}
        >
          Admin
        </Heading>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: FONT_SIZE.tag,
            letterSpacing: LETTER_SPACING.caps,
            textTransform: 'uppercase',
            color: COLORS.mute,
          }}
        >
          Owner tools
        </div>
      </div>
      <Surface elevation={1} padding={5}>
        <AdminSection me={me} />
      </Surface>
    </div>
  );
}
