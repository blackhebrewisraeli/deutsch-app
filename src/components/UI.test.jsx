import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './UI';

describe('Hero', () => {
  // The title was a hardcoded 72px. "Wortschatz" renders 370px wide at that
  // size, so on a 375px phone it pushed the page into a horizontal scroll —
  // on every tab, since every tab uses Hero. The size now scales with the
  // viewport and only reaches 72px when there is room for it.
  it('scales the title down rather than overflowing a narrow viewport', () => {
    render(<Hero kicker="Section 03" title="Wortschatz" sub="Flip, listen, learn." />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.style.fontSize).toBe('min(72px, 13vw)');
  });

  it('still renders kicker, title and sub', () => {
    render(<Hero kicker="Section 03" title="Wortschatz" sub="Flip, listen, learn." />);
    expect(screen.getByText('Section 03')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Wortschatz' })).toBeInTheDocument();
    expect(screen.getByText('Flip, listen, learn.')).toBeInTheDocument();
  });
});
