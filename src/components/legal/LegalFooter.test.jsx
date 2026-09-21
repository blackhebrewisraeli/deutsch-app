import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LegalFooter from './LegalFooter';

describe('LegalFooter', () => {
  it('renders both links as real anchors with real hrefs', () => {
    // Anchors, not buttons: a legal link has to be copyable, shareable and
    // openable in a new tab. A button satisfies none of those.
    render(<LegalFooter />);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  it('is not a navigation landmark', () => {
    // Two legal links are not a navigation region, and a second landmark
    // beside the app's real nav makes the landmark list worse, not better.
    const { container } = render(<LegalFooter />);
    expect(container.querySelector('nav')).toBeNull();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps a plain click inside the SPA', async () => {
    const onNavigate = vi.fn();
    render(<LegalFooter onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(onNavigate).toHaveBeenCalledWith('/privacy');
  });

  it('routes the terms link to its own path', async () => {
    const onNavigate = vi.fn();
    render(<LegalFooter onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Terms' }));
    expect(onNavigate).toHaveBeenCalledWith('/terms');
  });

  it('does not preventDefault, and does not intercept, a modified click', async () => {
    // Cmd/Ctrl/Shift/Alt-click means "open this somewhere else". Swallowing it
    // would break the one interaction people use to read terms in a new tab
    // while keeping their place in the app.
    const onNavigate = vi.fn();
    // One `setup()` session, not the direct API: each direct userEvent call
    // builds its own instance with fresh keyboard state, so a modifier held by
    // an earlier call is NOT applied to the next click. A test written that
    // way passes only because the modifier never reached the event.
    const user = userEvent.setup();
    render(<LegalFooter onNavigate={onNavigate} />);
    const privacy = screen.getByRole('link', { name: 'Privacy' });
    for (const key of ['Meta', 'Control', 'Shift', 'Alt']) {
      await user.keyboard(`{${key}>}`);
      await user.click(privacy);
      await user.keyboard(`{/${key}}`);
    }
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ignores a non-primary mouse button', () => {
    const onNavigate = vi.fn();
    render(<LegalFooter onNavigate={onNavigate} />);
    // fireEvent with an explicit `button`, NOT userEvent's [MouseMiddle]: a
    // real middle click dispatches `auxclick`, not `click`, so an onClick
    // handler never runs and a test written that way passes even with the
    // guard deleted. It was, and it did. This reaches the branch.
    fireEvent.click(screen.getByRole('link', { name: 'Privacy' }), { button: 1 });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not throw when no onNavigate is supplied', async () => {
    render(<LegalFooter />);
    await userEvent.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
  });
});
