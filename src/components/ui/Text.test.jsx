import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Body, Meta } from './Text';

describe('Body', () => {
  it('renders a paragraph by default', () => {
    const { container } = render(<Body>Ein Satz.</Body>);
    expect(container.firstChild.tagName).toBe('P');
  });

  it('renders the element `as` names', () => {
    const { container } = render(<Body as="span">Ein Satz.</Body>);
    expect(container.firstChild.tagName).toBe('SPAN');
  });

  // WCAG 1.4.12 minimum for body text, and what Hero's subtitle already uses.
  it('sets a 1.5 line height', () => {
    render(<Body data-testid="b">Ein Satz.</Body>);
    expect(screen.getByTestId('b')).toHaveStyle({ lineHeight: '1.5' });
  });

  it('carries no margin', () => {
    render(<Body data-testid="b">Ein Satz.</Body>);
    expect(screen.getByTestId('b')).toHaveStyle({ margin: '0px' });
  });

  it('sizes md and sm from the FONT_SIZE scale', () => {
    render(
      <>
        <Body data-testid="md">A</Body>
        <Body size="sm" data-testid="sm">
          B
        </Body>
      </>
    );
    expect(screen.getByTestId('md')).toHaveStyle({ fontSize: '15px' });
    expect(screen.getByTestId('sm')).toHaveStyle({ fontSize: '13px' });
  });

  it('applies the tone ink', () => {
    render(
      <Body tone="soft" data-testid="b">
        Ein Satz.
      </Body>
    );
    expect(screen.getByTestId('b')).toHaveStyle({ color: 'var(--c-fg-subtle)' });
  });

  it("lets the caller's style win", () => {
    render(
      <Body style={{ lineHeight: '2' }} data-testid="b">
        Ein Satz.
      </Body>
    );
    expect(screen.getByTestId('b')).toHaveStyle({ lineHeight: '2' });
  });

  // Not an accent-as-foreground: c.error is already swept as a FOREGROUND
  // against ground and surface-1/2/3 in both palettes (contrast.test.js),
  // so this tone introduces no new contrast pair.
  it('applies the error tone ink', () => {
    render(
      <Body tone="error" data-testid="e">
        Kaputt.
      </Body>
    );
    expect(screen.getByTestId('e')).toHaveStyle({ color: 'var(--c-error)' });
  });
});

describe('Meta', () => {
  it('renders a span by default', () => {
    const { container } = render(<Meta>Streak</Meta>);
    expect(container.firstChild.tagName).toBe('SPAN');
  });

  it('defaults to the muted tone', () => {
    render(<Meta data-testid="m">Streak</Meta>);
    expect(screen.getByTestId('m')).toHaveStyle({ color: 'var(--c-fg-muted)' });
  });

  // Uppercasing via CSS, never in the string: the accessible name stays in its
  // authored case, which is what a screen reader should read out.
  it('uppercases with CSS, leaving the text node in its authored case', () => {
    render(<Meta data-testid="m">Streak</Meta>);
    const el = screen.getByTestId('m');
    expect(el).toHaveStyle({ textTransform: 'uppercase' });
    expect(el.textContent).toBe('Streak');
  });

  it('takes an overriding tone', () => {
    render(
      <Meta tone="default" data-testid="m">
        Streak
      </Meta>
    );
    expect(screen.getByTestId('m')).toHaveStyle({ color: 'var(--c-fg)' });
  });

  it('spreads rest props onto the DOM node', () => {
    render(<Meta id="cap">Streak</Meta>);
    expect(document.getElementById('cap')).toBeInTheDocument();
  });
});
