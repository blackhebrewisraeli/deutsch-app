import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeckCompleteBanner from './DeckCompleteBanner';

describe('DeckCompleteBanner', () => {
  it('reports how many words were learned', () => {
    render(<DeckCompleteBanner learnedCount={7} onDismiss={() => {}} />);
    expect(screen.getByText(/7 words learned/)).toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const onDismiss = vi.fn();
    render(<DeckCompleteBanner learnedCount={3} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'DISMISS' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
