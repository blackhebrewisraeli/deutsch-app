import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { isGoogleAuthConfigured } = vi.hoisted(() => ({
  isGoogleAuthConfigured: vi.fn(() => true),
}));
vi.mock('../../lib/auth.js', () => ({ isGoogleAuthConfigured }));

import GoogleButton from './GoogleButton';

describe('GoogleButton', () => {
  beforeEach(() => {
    isGoogleAuthConfigured.mockReturnValue(true);
  });

  // Google's brand terms want this exact wording alongside the mark.
  it('renders Google’s required label', () => {
    render(<GoogleButton onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  // The mark is decorative — the label already names the provider, so a second
  // announcement would just be noise.
  it('carries the mark as a decorative image, not a themed icon', () => {
    const { container } = render(<GoogleButton onClick={() => {}} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/google-g.svg');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('alt', '');
  });

  it('fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GoogleButton onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // A redirect takes a beat; a double-tap must not start two round trips.
  it('is disabled while busy and does not fire', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<GoogleButton onClick={onClick} busy />);
    const button = screen.getByRole('button', { name: 'Continue with Google' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  // No dead affordance: the guard is in the component so no call site can
  // forget it.
  it('renders nothing when Google is not configured', () => {
    isGoogleAuthConfigured.mockReturnValue(false);
    const { container } = render(<GoogleButton onClick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
