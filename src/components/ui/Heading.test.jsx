import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Heading from './Heading';

// jsdom's default. Set explicitly so a test that changes it cannot leak a width
// into the next one — the display-size cases below depend on this value.
const DEFAULT_WIDTH = 1024;

beforeEach(() => {
  window.innerWidth = DEFAULT_WIDTH;
});

describe('Heading', () => {
  it('renders the tag its level names', () => {
    render(<Heading level={3}>Vokabeln</Heading>);
    expect(screen.getByRole('heading', { level: 3, name: 'Vokabeln' })).toBeInTheDocument();
  });

  it('defaults to level 2', () => {
    render(<Heading>Vokabeln</Heading>);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  // The whole reason level and size are separate props. A system where one prop
  // drives both eventually ships an <h4> styled as a page title, and heading
  // order is what a screen-reader user navigates by.
  it('keeps semantics when only the visual size changes', () => {
    render(
      <Heading level={2} size="sm">
        Vokabeln
      </Heading>
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  // The case that catches a size→tag coupling the `size="sm"` test above cannot:
  // `display` is level 1's default size, so a naive implementation is most
  // likely to hardcode <h1> exactly here.
  it('keeps semantics at the display size too', () => {
    render(
      <Heading level={2} size="display">
        Wortschatz
      </Heading>
    );
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('keeps the visual size when only the element changes', () => {
    const { container } = render(
      <Heading level={2} as="div">
        Vokabeln
      </Heading>
    );
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.firstChild.tagName).toBe('DIV');
  });

  it('carries no margin, so Stack owns vertical rhythm', () => {
    render(<Heading>Vokabeln</Heading>);
    expect(screen.getByRole('heading')).toHaveStyle({ margin: '0px' });
  });

  it('applies the tone ink', () => {
    render(<Heading tone="muted">Vokabeln</Heading>);
    expect(screen.getByRole('heading')).toHaveStyle({ color: 'var(--c-fg-muted)' });
  });

  it("lets the caller's style win over the recipe", () => {
    render(<Heading style={{ letterSpacing: '1px' }}>Vokabeln</Heading>);
    expect(screen.getByRole('heading')).toHaveStyle({ letterSpacing: '1px' });
  });

  it('spreads rest props onto the DOM node', () => {
    render(<Heading data-testid="h">Vokabeln</Heading>);
    expect(screen.getByTestId('h')).toBeInTheDocument();
  });

  // jsdom reads `min(72px, 13vw)` back mangled, so a CSS clamp here has no
  // assertable form. Computing it in JS gives the same rendered result and a
  // number a test can pin.
  it('computes the display size in JS, not CSS', () => {
    window.innerWidth = 320;
    render(
      <Heading level={1} size="display">
        Wortschatz
      </Heading>
    );
    // min(72, 320 * 0.13) = 41.6
    expect(screen.getByRole('heading')).toHaveStyle({ fontSize: '41.6px' });
  });

  it('caps the display size at 72px on wide viewports', () => {
    window.innerWidth = 1200;
    render(
      <Heading level={1} size="display">
        Wortschatz
      </Heading>
    );
    expect(screen.getByRole('heading')).toHaveStyle({ fontSize: '72px' });
  });

  it('sizes the non-display levels from the FONT_SIZE scale', () => {
    render(
      <>
        <Heading level={2} data-testid="h2">
          A
        </Heading>
        <Heading level={3} data-testid="h3">
          B
        </Heading>
        <Heading level={4} data-testid="h4">
          C
        </Heading>
      </>
    );
    expect(screen.getByTestId('h2')).toHaveStyle({ fontSize: '24px' });
    expect(screen.getByTestId('h3')).toHaveStyle({ fontSize: '20px' });
    expect(screen.getByTestId('h4')).toHaveStyle({ fontSize: '18px' });
  });
});
