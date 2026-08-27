import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InteractiveCard from './InteractiveCard';

describe('InteractiveCard', () => {
  // This assertion is the primitive's entire reason to exist. Fourteen league
  // rows shipped as `<li onClick>` — dead to Tab, invisible to a screen reader
  // as controls — and stayed that way through a green 1,600-test suite, because
  // nothing about a click handler on a list item is detectable from the DOM
  // assertions those tests were making.
  it('renders a native button, so it is in the tab order', async () => {
    render(<InteractiveCard>Deck A</InteractiveCard>);
    const card = screen.getByRole('button', { name: 'Deck A' });
    expect(card.tagName).toBe('BUTTON');
    await userEvent.tab();
    expect(document.activeElement).toBe(card);
  });

  it('activates on Enter and on Space without hand-rolled key handling', async () => {
    const onClick = vi.fn();
    render(<InteractiveCard onClick={onClick}>Deck A</InteractiveCard>);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('renders a link when asked, and keeps the href', () => {
    render(
      <InteractiveCard as="a" href="/stats">
        Stats
      </InteractiveCard>
    );
    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/stats');
  });

  // `as` accepts nothing else. A div with role+tabIndex+onKeyDown hand-rolls
  // activation, the disabled state, form participation and the focus ring that
  // the native element gives for free.
  it('refuses any element that is not a button or a link', () => {
    render(<InteractiveCard as="div">Deck A</InteractiveCard>);
    expect(screen.getByRole('button', { name: 'Deck A' }).tagName).toBe('BUTTON');
  });

  it('signals selection to assistive tech, not by colour alone', () => {
    render(<InteractiveCard selected>Deck A</InteractiveCard>);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    // The non-colour channel required by WCAG 1.4.1. Asserted through
    // .style.border because jsdom never expands a var() shorthand — see
    // Surface.test.jsx.
    expect(card.style.border).toBe('1px solid var(--c-border-strong)');
  });

  it('uses the plain hairline when not selected', () => {
    render(<InteractiveCard>Deck A</InteractiveCard>);
    expect(screen.getByRole('button').style.border).toBe('1px solid var(--c-border)');
  });

  it('uses aria-current for a selected link', () => {
    render(
      <InteractiveCard as="a" href="/stats" selected>
        Stats
      </InteractiveCard>
    );
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'true');
  });

  it('disables a button natively', () => {
    render(<InteractiveCard disabled>Deck A</InteractiveCard>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  // There is no disabled attribute for links, so the href has to go — a link
  // that keeps its href while claiming to be disabled is still navigable.
  it('drops the href and marks aria-disabled on a disabled link', () => {
    render(
      <InteractiveCard as="a" href="/stats" disabled>
        Stats
      </InteractiveCard>
    );
    const el = screen.getByText('Stats');
    expect(el).not.toHaveAttribute('href');
    expect(el).toHaveAttribute('aria-disabled', 'true');
  });

  // A <button> centres its content and inherits none of the page font.
  it('resets the native button typography and alignment', () => {
    render(<InteractiveCard>Deck A</InteractiveCard>);
    expect(screen.getByRole('button')).toHaveStyle({ textAlign: 'left' });
  });

  it('opts into the inset focus ring, being full-bleed in a list', () => {
    render(<InteractiveCard>Deck A</InteractiveCard>);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('data-ui', 'button');
    expect(card).toHaveAttribute('data-focus-inset');
  });

  it('walks the same elevation ramp as Surface', () => {
    render(<InteractiveCard elevation={2}>Deck A</InteractiveCard>);
    expect(screen.getByRole('button')).toHaveStyle({ background: 'var(--c-surface-3)' });
  });

  it("lets the caller's style win", () => {
    render(<InteractiveCard style={{ textAlign: 'center' }}>Deck A</InteractiveCard>);
    expect(screen.getByRole('button')).toHaveStyle({ textAlign: 'center' });
  });
});
