import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppFooter from './AppFooter';

describe('AppFooter', () => {
  it('renders both links as real anchors with real hrefs', () => {
    // Anchors, not buttons: a legal link has to be copyable, shareable and
    // openable in a new tab. A button satisfies none of those.
    render(<AppFooter />);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
  });

  it('is not a navigation landmark', () => {
    // Two legal links are not a navigation region, and a second landmark
    // beside the app's real nav makes the landmark list worse, not better.
    const { container } = render(<AppFooter />);
    expect(container.querySelector('nav')).toBeNull();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps a plain click inside the SPA', async () => {
    const onNavigate = vi.fn();
    render(<AppFooter onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(onNavigate).toHaveBeenCalledWith('/privacy');
  });

  it('routes the terms link to its own path', async () => {
    const onNavigate = vi.fn();
    render(<AppFooter onNavigate={onNavigate} />);
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
    render(<AppFooter onNavigate={onNavigate} />);
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
    render(<AppFooter onNavigate={onNavigate} />);
    // fireEvent with an explicit `button`, NOT userEvent's [MouseMiddle]: a
    // real middle click dispatches `auxclick`, not `click`, so an onClick
    // handler never runs and a test written that way passes even with the
    // guard deleted. It was, and it did. This reaches the branch.
    fireEvent.click(screen.getByRole('link', { name: 'Privacy' }), { button: 1 });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('does not throw when no onNavigate is supplied', async () => {
    render(<AppFooter />);
    await userEvent.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
  });

  // ── The row ───────────────────────────────────────────────────────────────

  it('is the contentinfo landmark, exactly once', () => {
    // App.jsx used to own the <footer> and pass the links in. Owning it here is
    // the whole point of the component; two contentinfo landmarks, or none,
    // both mean the move was done wrong.
    const { container } = render(<AppFooter />);
    expect(container.querySelectorAll('footer')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('puts the links and the credit in one row, not stacked', () => {
    // The defect this redesign fixes: Privacy/Terms sat in their own centered
    // row BELOW the credit line, reading as an afterthought. Sharing a parent
    // is what makes them one row — re-stacking them fails here.
    render(<AppFooter />);
    const privacy = screen.getByRole('link', { name: 'Privacy' });
    const terms = screen.getByRole('link', { name: 'Terms' });
    const credit = screen.getByText(/Powered by Claude/i);
    expect(privacy.parentElement).toBe(terms.parentElement);
    expect(privacy.parentElement).toBe(credit.parentElement);
  });

  it('hides the decorative strap on mobile and keeps the legal links', () => {
    // The links are the one thing that renders at EVERY width: hiding them on
    // a phone would leave most of the audience with no route to the privacy
    // policy at all, which is the single thing they exist to prevent.
    render(<AppFooter mobile />);
    expect(screen.queryByText(/Lernen/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument();
  });

  it('shows the strap above mobile', () => {
    render(<AppFooter />);
    expect(screen.getByText(/Lernen/i)).toBeInTheDocument();
  });

  it('centers the row on mobile and spreads it above mobile', () => {
    // With the strap gone, `space-between` has nothing to push against and
    // jams the links against the right edge. Asserted on the style rather than
    // a rendered position because jsdom reports every rect as 0x0.
    const { container: phone } = render(<AppFooter mobile />);
    const { container: desk } = render(<AppFooter />);
    const row = (c) => c.querySelector('footer > div');
    expect(row(phone).style.justifyContent).toBe('center');
    expect(row(desk).style.justifyContent).toBe('space-between');
  });

  it('keeps the separators out of the accessible name', () => {
    // A screen reader should hear "Privacy", not "Privacy middle dot". The
    // separators are decoration, so they are aria-hidden — and getByRole
    // computes the accessible name, so this fails if they are not.
    render(<AppFooter />);
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms' })).toBeInTheDocument();
    const { container } = render(<AppFooter />);
    const dots = [...container.querySelectorAll('span')].filter((s) => s.textContent === '·');
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) expect(dot).toHaveAttribute('aria-hidden', 'true');
  });
});
