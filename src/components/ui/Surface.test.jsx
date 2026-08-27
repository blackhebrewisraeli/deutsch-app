import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Surface from './Surface';

describe('Surface', () => {
  it('renders a div by default with elevation 1', () => {
    render(<Surface data-testid="s">card</Surface>);
    expect(screen.getByTestId('s')).toHaveStyle({ background: 'var(--c-surface)' });
  });

  it('walks the elevation ramp', () => {
    render(
      <>
        <Surface elevation={0} data-testid="e0" />
        <Surface elevation={1} data-testid="e1" />
        <Surface elevation={2} data-testid="e2" />
      </>
    );
    expect(screen.getByTestId('e0')).toHaveStyle({ background: 'var(--c-surface-alt)' });
    expect(screen.getByTestId('e1')).toHaveStyle({ background: 'var(--c-surface)' });
    expect(screen.getByTestId('e2')).toHaveStyle({ background: 'var(--c-surface-3)' });
  });

  // SHADOW.card is a fixed light-mode rgba and is nearly invisible on a dark
  // plane. The hairline is what actually separates the card from its ground in
  // dark mode, which is why CARD.base already carries both. A primitive that
  // "cleans up" the apparent redundancy breaks dark mode, and no unit test that
  // only checks the background would notice.
  //
  // Asserted through `.style.border` rather than toHaveStyle: jsdom stores a
  // CSS SHORTHAND containing var() verbatim but never expands it into
  // longhands (`style.borderWidth` reads back ''), and toHaveStyle compares
  // against the computed longhands — so the shorthand silently never matches.
  // Single-value properties with var() (background, color) are fine; it is only
  // the shorthand. Same family as min()/calc() being unreadable here.
  it('carries a hairline at every elevation, not just a shadow', () => {
    for (const e of [0, 1, 2]) {
      const { getByTestId, unmount } = render(<Surface elevation={e} data-testid="s" />);
      expect(getByTestId('s').style.border).toBe('1px solid var(--c-border)');
      unmount();
    }
  });

  it('keeps the shadow as well, for the light-mode lift', () => {
    render(<Surface data-testid="s" />);
    expect(screen.getByTestId('s').style.boxShadow).not.toBe('');
  });

  it('renders the element `as` names, for landmarks', () => {
    const { container } = render(<Surface as="section" aria-label="Stats" />);
    expect(container.firstChild.tagName).toBe('SECTION');
  });

  it('takes padding from the SPACE scale', () => {
    render(<Surface padding={6} data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ padding: '24px' });
  });

  it('accepts zero padding', () => {
    render(<Surface padding={0} data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ padding: '0px' });
  });

  it('takes its radius from the RADIUS scale', () => {
    render(<Surface radius="lg" data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ borderRadius: '16px' });
  });

  it("lets the caller's style win", () => {
    render(<Surface style={{ background: 'transparent' }} data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveStyle({ background: 'transparent' });
  });

  it('spreads rest props onto the DOM node', () => {
    render(<Surface id="panel" />);
    expect(document.getElementById('panel')).toBeInTheDocument();
  });
});
