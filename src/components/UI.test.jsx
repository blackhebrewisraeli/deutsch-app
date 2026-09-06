import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero, SectionLabel, StatBlock } from './UI';

describe('Hero', () => {
  // The title was a hardcoded 72px. "Wortschatz" renders 370px wide at that
  // size, so on a 375px phone it pushed the page into a horizontal scroll —
  // on every tab, since every tab uses Hero. The size still scales with the
  // viewport and only reaches 72px when there is room for it.
  //
  // This used to assert the authored string `min(72px, 13vw)`. That pinned the
  // DECLARATION, not the result: jsdom keeps min() in the style attribute but
  // drops it from computed style, so the test could never have told you what
  // size actually rendered. The curve is identical, now computed in JS from the
  // viewport, and the two assertions below pin the resulting number instead.
  it('scales the title down rather than overflowing a narrow viewport', () => {
    window.innerWidth = 375;
    render(<Hero kicker="Section 03" title="Wortschatz" sub="Flip, listen, learn." />);
    // min(72, 375 * 0.13) = 48.75 — well under the 370px the flat 72px produced.
    expect(screen.getByRole('heading', { level: 1 })).toHaveStyle({ fontSize: '48.75px' });
  });

  it('still reaches 72px where there is room', () => {
    window.innerWidth = 1200;
    render(<Hero kicker="Section 03" title="Wortschatz" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveStyle({ fontSize: '72px' });
  });

  it('still renders kicker, title and sub', () => {
    render(<Hero kicker="Section 03" title="Wortschatz" sub="Flip, listen, learn." />);
    expect(screen.getByText('Section 03')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Wortschatz' })).toBeInTheDocument();
    expect(screen.getByText('Flip, listen, learn.')).toBeInTheDocument();
  });

  it('can center the kicker, title and subtitle as a column', () => {
    const { container } = render(
      <Hero align="center" kicker="Section 04" title="Wortschatz" sub="Flip, listen, learn." />
    );
    expect(container.firstChild).toHaveStyle({
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    });
    expect(screen.getByText('Flip, listen, learn.')).toHaveStyle({
      marginLeft: 'auto',
      marginRight: 'auto',
    });
  });

  it('renders the hero title as an h1', () => {
    render(<Hero kicker="A" title="Wortschatz" sub="Sub" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Wortschatz' })).toBeInTheDocument();
  });

  // The same 72px / 13vw curve, computed in JS. As `min(72px, 13vw)` it
  // rendered correctly but had no assertable COMPUTED form — jsdom drops it, so
  // toHaveStyle receives nothing. A number can be pinned at a known viewport.
  it('sizes the hero title from the viewport, in JS', () => {
    window.innerWidth = 320;
    render(<Hero kicker="A" title="Wortschatz" />);
    // min(72, 320 * 0.13) = 41.6
    expect(screen.getByRole('heading', { level: 1 })).toHaveStyle({ fontSize: '41.6px' });
  });
});

describe('SectionLabel', () => {
  it('renders its number and text', () => {
    render(<SectionLabel num="A" text="Scenario" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Scenario')).toBeInTheDocument();
  });
});

describe('StatBlock', () => {
  it('renders label and value', () => {
    render(<StatBlock label="Streak" value="7" icon={<span data-testid="i" />} />);
    expect(screen.getByText('Streak')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByTestId('i')).toBeInTheDocument();
  });

  // Callers pass an empty label to drop the caption where width is tight (the
  // mobile header): the icon and value still carry the signal.
  it('drops the caption when the caller passes an empty label', () => {
    render(<StatBlock label="" value="7" icon={<span />} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByText('Streak')).not.toBeInTheDocument();
  });
});
