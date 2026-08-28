import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PerTabBars from './PerTabBars';

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
});
