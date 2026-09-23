import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LevelCard from './LevelCard';
import { FONT_SIZE, SPACE } from '../../lib/theme';

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
};

const lvl = {
  level: 30,
  rankName: 'Muttersprachler',
  progress: 0.5,
  xpIntoLevel: 150,
  xpToNext: 300,
};

describe('LevelCard', () => {
  // A bare `auto 1fr auto` keeps min-width auto on the middle track, so it
  // refuses to shrink below its content. With a real level-30 account the rank
  // name pushed this card to 376px inside 337px — a sideways-scrolling Stats
  // tab on a 375px phone. minmax(0, …) lets the track shrink and the text wrap.
  it('lets its middle column shrink instead of widening the page', () => {
    const { container } = render(<LevelCard lvl={lvl} totalXp={21900} learnedCount={0} />);
    expect(container.firstElementChild.style.gridTemplateColumns).toBe('auto minmax(0, 1fr) auto');
  });

  it('renders the level and rank', () => {
    render(<LevelCard lvl={lvl} totalXp={21900} learnedCount={0} />);
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('Muttersprachler')).toBeInTheDocument();
  });

  it.each([320, 375])('uses the compact stat scale at %spx', (width) => {
    setViewportWidth(width);
    render(<LevelCard lvl={lvl} totalXp={21900} learnedCount={1234} />);

    expect(screen.getByTestId('level-card')).toHaveStyle({
      padding: `${SPACE[4]}px`,
      gap: `${SPACE[3]}px`,
    });
    expect(screen.getByText('30')).toHaveStyle({ fontSize: `${FONT_SIZE['5xl']}px` });
    expect(screen.getByText('1234')).toHaveStyle({ fontSize: `${FONT_SIZE['3xl']}px` });
    expect(screen.getByText('Muttersprachler')).toHaveStyle({
      fontSize: `${FONT_SIZE.xl}px`,
      overflowWrap: 'anywhere',
    });
  });
});
