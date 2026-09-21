import { FONTS, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../../lib/theme';
import Heading from '../ui/Heading';
import Surface from '../ui/Surface';
import AdminSection from './AdminSection';

export default function AdminTab({ me }) {
  if (!me?.isAdmin) return null;

  return (
    <div>
      <Heading
        level={1}
        size="xl"
        style={{
          fontFamily: FONTS.body,
          fontWeight: FONT_WEIGHT.bold,
          letterSpacing: LETTER_SPACING.tight,
          marginBottom: SPACE[4],
        }}
      >
        Admin
      </Heading>
      <Surface elevation={1} padding={4}>
        <AdminSection me={me} />
      </Surface>
    </div>
  );
}
