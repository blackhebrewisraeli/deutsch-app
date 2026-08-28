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
  it('centres within the app measure', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const el = screen.getByTestId('p');
    expect(el.style.marginInline).toBe('auto');
    // 1400, not 900. The 900 default was written with no consumer to check it
    // against; the shell is 1400, and moving the app to 900 would cut Chat's
    // conversation column from 688px to 188px (spec §3.3).
    expect(el).toHaveStyle({ maxWidth: '1400px' });
  });

  // In this app the inline and top gutters are always the same number —
  // 16 mobile, 32 desktop — so one prop describes both (spec §4.1).
  it('applies the gutter to the inline edges and the top alike', () => {
    render(
      <PageFrame gutter={8} data-testid="p">
        x
      </PageFrame>
    );
    const el = screen.getByTestId('p');
    expect(el.style.paddingInline).toBe('32px');
    expect(el.style.paddingTop).toBe('32px');
  });

  it('defaults the gutter to SPACE[4]', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const el = screen.getByTestId('p');
    expect(el.style.paddingInline).toBe('16px');
    expect(el.style.paddingTop).toBe('16px');
  });

  // The defect this prevents (spec §3.4): PageFrame used to set
  // `paddingBottom: env(safe-area-inset-bottom, 0px)`, which computes to 0 on
  // desktop. <main> has a real 32px bottom gutter, so adopting the primitive
  // naively would have removed it from every tab — invisible to unit tests,
  // visible as content sitting closer to the nav. `bottomGutter` is what keeps
  // that gutter real, and this asserts it survives.
  //
  // The inset term is gone with it. The app does not opt into safe areas, so
  // env(safe-area-inset-bottom) resolved to 0 everywhere and only made the
  // declaration look load-bearing. src/safeArea.test.js holds that line: if
  // index.html ever gains viewport-fit=cover, it fails until the inset comes
  // back here — ADDED to the gutter, never replacing it.
  it('gives the bottom a real gutter, with no inert safe-area term', () => {
    render(<PageFrame data-testid="p">x</PageFrame>);
    const pb = screen.getByTestId('p').style.paddingBottom;
    expect(pb).toBe('32px');
    expect(pb).not.toContain('safe-area-inset');
  });

  it('takes the bottom gutter from the SPACE scale', () => {
    render(
      <PageFrame bottomGutter={4} data-testid="p">
        x
      </PageFrame>
    );
    expect(screen.getByTestId('p').style.paddingBottom).toContain('16px');
  });

  it('renders the element `as` names, so <main> can be one', () => {
    const { container } = render(<PageFrame as="main">x</PageFrame>);
    expect(container.firstChild.tagName).toBe('MAIN');
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
