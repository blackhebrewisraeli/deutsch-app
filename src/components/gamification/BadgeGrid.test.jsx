import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeGrid from './BadgeGrid';
import { ACHIEVEMENTS } from '../../lib/gamification';
import { BORDER, FONT_SIZE, LINE_HEIGHT } from '../../lib/theme';

const tiles = () => screen.getAllByRole('listitem');

describe('BadgeGrid', () => {
  it('renders only earned badges — locked ones are not in the DOM at all', () => {
    // Derived from the catalogue, not hardcoded: a literal count goes stale
    // every time a badge is added.
    const [first, second, ...locked] = ACHIEVEMENTS;
    expect(locked.length).toBeGreaterThan(0);
    render(<BadgeGrid achievements={{ [first.id]: 1, [second.id]: 2 }} />);

    expect(tiles()).toHaveLength(2);
    expect(screen.getByText(first.name)).toBeInTheDocument();
    expect(screen.getByText(second.name)).toBeInTheDocument();
    for (const a of locked) expect(screen.queryByText(a.name)).not.toBeInTheDocument();
    expect(screen.queryByText('GESPERRT')).not.toBeInTheDocument();
  });

  it.each([{}, undefined, null])('shows an empty state, not an empty list, for %s', (a) => {
    render(<BadgeGrid achievements={a} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/no badges yet/i)).toBeInTheDocument();
  });

  it('draws tiles flat with a hairline and takes every size from a token', () => {
    render(<BadgeGrid achievements={{ [ACHIEVEMENTS[0].id]: 1 }} />);
    const [tile] = tiles();
    expect(tile.style.boxShadow).toBe('');
    expect(tile.style.border).toBe(BORDER.panel);

    const [icon, name] = tile.children;
    expect(icon.style.fontSize).toBe(`${FONT_SIZE['2xl']}px`);
    expect(icon.style.lineHeight).toBe(String(LINE_HEIGHT.tight));
    expect(name.style.fontSize).toBe(`${FONT_SIZE.base}px`);
    expect(name.style.lineHeight).toBe(String(LINE_HEIGHT.snug));
  });
});
