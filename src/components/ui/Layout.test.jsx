import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stack, Row, Grid, PageFrame } from './Layout';

describe('Stack', () => {
  it('stacks vertically with a gap from the SPACE scale', () => {
    render(
      <Stack gap={6} data-testid="s">
        x
      </Stack>
    );
    expect(screen.getByTestId('s')).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    });
  });

  it('defaults to a SPACE[4] gap', () => {
    render(<Stack data-testid="s">x</Stack>);
    expect(screen.getByTestId('s')).toHaveStyle({ gap: '16px' });
  });

  it('renders as a list when asked, so a list of cards keeps its semantics', () => {
    render(
      <Stack as="ul" data-testid="s">
        <li>a</li>
      </Stack>
    );
    expect(screen.getByTestId('s').tagName).toBe('UL');
  });
});

describe('Row', () => {
  // At 320px a non-wrapping row is this app's most common overflow source, so
  // wrapping is the default and opting out is something you have to write down.
  it('wraps by default', () => {
    render(<Row data-testid="r">x</Row>);
    expect(screen.getByTestId('r')).toHaveStyle({ flexWrap: 'wrap' });
  });

  it('lets a caller opt out of wrapping explicitly', () => {
    render(
      <Row wrap={false} data-testid="r">
        x
      </Row>
    );
    expect(screen.getByTestId('r')).toHaveStyle({ flexWrap: 'nowrap' });
  });

  // Necessary but NOT sufficient — see the Layout doc comment. It is here so
  // text can shrink at all; what happens when it does not fit is the caller's
  // declaration.
  it('sets minWidth 0 on itself so it can shrink below its content', () => {
    render(<Row data-testid="r">x</Row>);
    // React emits `min-width: 0` unitless here, so read the authored value.
    expect(screen.getByTestId('r').style.minWidth).toBe('0');
  });

  it('centres its items by default', () => {
    render(<Row data-testid="r">x</Row>);
    expect(screen.getByTestId('r')).toHaveStyle({ alignItems: 'center' });
  });
});

describe('Grid', () => {
  // A bare `1fr` keeps min-width:auto, so the track refuses to shrink below its
  // content and pushes the page wider than the viewport. That defect shipped
  // four separate times (docs/DEMO_READINESS.md #15-#17).
  it('emits minmax(0, 1fr), never a bare 1fr', () => {
    render(
      <Grid columns={3} data-testid="g">
        x
      </Grid>
    );
    expect(screen.getByTestId('g').style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('emits minmax on the auto-fit path too', () => {
    render(
      <Grid columns="auto-fit" min={140} data-testid="g">
        x
      </Grid>
    );
    expect(screen.getByTestId('g').style.gridTemplateColumns).toBe(
      'repeat(auto-fit, minmax(140px, 1fr))'
    );
  });

  // The sweep that matters: it covers every path, so a future edit cannot
  // reintroduce a bare track on a branch the two tests above do not exercise.
  it('never produces the substring "1fr" without a minmax around it', () => {
    for (const props of [
      { columns: 1 },
      { columns: 2 },
      { columns: 4 },
      { columns: 'auto-fit', min: 90 },
      { columns: 'auto-fit' },
    ]) {
      const { getByTestId, unmount } = render(
        <Grid {...props} data-testid="g">
          x
        </Grid>
      );
      const tracks = getByTestId('g').style.gridTemplateColumns;
      expect(tracks).toContain('minmax(');
      // Blank out the legitimate minmax() first. The obvious `/[(,]\s*1fr/`
      // matches `minmax(0, 1fr)` as readily as a bare `1fr`, so it fires on
      // correct code and can never distinguish the defect it exists to catch.
      expect(tracks.replace(/minmax\([^)]*\)/g, 'MINMAX')).not.toContain('1fr');
      unmount();
    }
  });
});

describe('PageFrame', () => {
  it('centres within a max measure', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const el = screen.getByTestId('p');
    expect(el.style.marginInline).toBe('auto');
    expect(el).toHaveStyle({ maxWidth: '900px' });
  });

  // The safe-area inset has NO assertable form in jsdom: unlike var(), which
  // jsdom stores verbatim, env() is dropped outright — `padding-bottom` does not
  // appear in the style attribute at all. Asserting it here is impossible, not
  // merely awkward, so it is verified in a real browser instead (see the PR).
  // What IS assertable is that nothing else clobbers the declaration.
  it('does not let another padding declaration replace the safe-area inset', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const attr = screen.getByTestId('p').getAttribute('style');
    expect(attr).not.toMatch(/padding-bottom/);
    expect(attr).toContain('padding-inline');
  });

  it('takes its gutter from the SPACE scale', () => {
    render(
      <PageFrame gutter={3} data-testid="p">
        x
      </PageFrame>
    );
    expect(screen.getByTestId('p').style.paddingInline).toBe('12px');
  });
});

describe('every layout primitive', () => {
  it("lets the caller's style win", () => {
    render(
      <>
        <Stack style={{ gap: '1px' }} data-testid="s" />
        <Row style={{ flexWrap: 'nowrap' }} data-testid="r" />
        <Grid style={{ gridTemplateColumns: 'none' }} data-testid="g" />
        <PageFrame style={{ maxWidth: 100 }} data-testid="p" />
      </>
    );
    expect(screen.getByTestId('s')).toHaveStyle({ gap: '1px' });
    expect(screen.getByTestId('r')).toHaveStyle({ flexWrap: 'nowrap' });
    expect(screen.getByTestId('g').style.gridTemplateColumns).toBe('none');
    expect(screen.getByTestId('p')).toHaveStyle({ maxWidth: '100px' });
  });

  it('spreads rest props onto the DOM node', () => {
    render(
      <>
        <Stack id="a" />
        <Row id="b" />
        <Grid id="c" />
        <PageFrame id="d" />
      </>
    );
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(document.getElementById(id)).toBeInTheDocument();
    }
  });
});
