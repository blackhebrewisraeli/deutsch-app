import { COLORS, FONTS, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, SPACE } from '../../lib/theme';

/**
 * The small uppercase mono label that titles a section.
 *
 * Nine components inline these exact declarations today (QuestBoard, HomeTab,
 * PersonalHub, VocabTab, …). This is the primitive they should all reach for;
 * it exists because a tenth copy in a NEW file is what SonarCloud's duplication
 * gate counts, and copying a recipe a tenth time is the wrong answer anyway.
 *
 * Deliberately NOT applied to the existing nine in this PR: that is a
 * codebase-wide refactor with its own blast radius, and the recipe is also worn
 * by unit labels and empty states that mean something different — see the note
 * in the style-recipe audit. Migrate them deliberately, not by grep.
 */
export default function SectionLabel({ as: Tag = 'div', style, children, ...rest }) {
  return (
    <Tag
      style={{
        fontFamily: FONTS.mono,
        fontSize: FONT_SIZE.tag,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: LETTER_SPACING.caps,
        textTransform: 'uppercase',
        color: COLORS.mute,
        marginBottom: SPACE[3],
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
