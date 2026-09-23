import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlacementOfferBanner from './PlacementOfferBanner';

describe('PlacementOfferBanner', () => {
  it('invites the test without blocking the rest of the page', async () => {
    const onRetake = vi.fn();
    const onDismiss = vi.fn();
    render(<PlacementOfferBanner onRetake={onRetake} onDismiss={onDismiss} />);

    const region = screen.getByRole('region', { name: /ready to check your level/i });
    expect(region).toBeInTheDocument();
    expect(screen.getByText(/earned 500 XP/i)).toBeInTheDocument();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /take the test/i }));
    expect(onRetake).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
