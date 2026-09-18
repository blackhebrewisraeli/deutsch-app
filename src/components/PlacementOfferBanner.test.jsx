import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlacementOfferBanner from './PlacementOfferBanner';

describe('PlacementOfferBanner', () => {
  it('invites a retake without blocking the rest of the page', async () => {
    const onRetake = vi.fn();
    const onDismiss = vi.fn();
    render(<PlacementOfferBanner onRetake={onRetake} onDismiss={onDismiss} />);

    const region = screen.getByRole('region', { name: /ready to retake placement/i });
    expect(region).toBeInTheDocument();
    expect(screen.getByText(/3 vocab decks/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retake placement/i }));
    expect(onRetake).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
