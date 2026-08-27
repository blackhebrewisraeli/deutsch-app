import { TEXT, FONT_SIZE } from '../../lib/theme';
import { useWindowWidth } from '../../lib/useWindowWidth';
import { TONE } from './tone';

// `level` is document semantics, `size` is appearance, and they are separate
// props on purpose. Heading order is an a11y contract — a screen-reader user
// navigating by heading needs h1 → h2 → h3 to reflect structure, not visual
// weight. One prop driving both is how a design system ends up with an <h4>
// styled as a page title, and it costs one prop to make the wrong thing require
// typing.
const SIZE = {
  xl: FONT_SIZE['3xl'], // 24
  lg: FONT_SIZE['2xl'], // 20
  md: FONT_SIZE.xl, // 18
  sm: FONT_SIZE.lg, // 16
};

const LEVEL_SIZE = { 1: 'display', 2: 'xl', 3: 'lg', 4: 'md' };

// The display size is computed in JS rather than as `min(72px, 13vw)`, because
// jsdom reads CSS min()/calc() back mangled and a clamp written that way has no
// assertable form — the test that "covers" it is asserting a garbled string.
// 13vw reaches 72px at ~554px, so desktop is unchanged and only small viewports
// scale down. This is the same curve Hero shipped, in a form a test can pin.
const DISPLAY_MAX = 72;
const DISPLAY_VW = 0.13;

export default function Heading({
  level = 2,
  size,
  as,
  tone = 'default',
  style,
  children,
  ...rest
}) {
  const width = useWindowWidth();
  const Tag = as ?? `h${level}`;
  const key = size ?? LEVEL_SIZE[level] ?? 'xl';
  const fontSize = key === 'display' ? Math.min(DISPLAY_MAX, width * DISPLAY_VW) : SIZE[key];

  return (
    <Tag
      style={{
        ...TEXT.display,
        fontSize,
        color: TONE[tone] ?? TONE.default,
        // Spacing between blocks belongs to Stack. A heading that carries its
        // own margin makes vertical rhythm unpredictable in a flex column.
        margin: 0,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
