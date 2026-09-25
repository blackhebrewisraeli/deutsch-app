import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PerTabBars from './PerTabBars';
import { FONT_SIZE, SPACE } from '../../lib/theme';

describe('PerTabBars', () => {
  it('renders a labeled bar per tab with count and share', () => {
    render(<PerTabBars breakdown={{ chat: 2, alphabet: 0, vocab: 5, translate: 1 }} />);
    expect(screen.getByText('01 Chat')).toBeInTheDocument();
    expect(screen.getByText('03 Vocab')).toBeInTheDocument();
    // vocab 5 of 8 total → 63%
    expect(screen.getByText(/5 \(63%\)/)).toBeInTheDocument();
  });

  it('shows the empty state when every tab is zero', () => {
    render(<PerTabBars breakdown={{ chat: 0, alphabet: 0, vocab: 0, translate: 0 }} />);
    expect(screen.getByText('No exercises recorded yet.')).toBeInTheDocument();
    expect(document.querySelector('[data-ui="status-note"]')).not.toBeNull();
  });

  it('uses dashboard-scale gaps, labels and progress tracks', () => {
    render(<PerTabBars breakdown={{ chat: 2, alphabet: 0, vocab: 5, translate: 1 }} />);
    expect(screen.getByTestId('per-tab-bars')).toHaveStyle({ gap: `${SPACE[2]}px` });
    expect(screen.getByText('01 Chat').parentElement).toHaveStyle({
      fontSize: `${FONT_SIZE.tag}px`,
    });
    for (const track of screen.getAllByTestId('per-tab-track')) {
      expect(track).toHaveStyle({ height: '6px' });
    }
  });
});
