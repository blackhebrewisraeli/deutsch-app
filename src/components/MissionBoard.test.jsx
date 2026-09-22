import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MissionBoard from './MissionBoard';
import ErrorBoundary from './ErrorBoundary';
import { FONTS, FONT_SIZE, SPACE } from '../lib/theme';

const due = { id: 'srs-due', count: 12, tab: 'vocab', priority: 0 };
const goal = { id: 'goal-remaining', count: 30, tab: 'chat', priority: 2 };

describe('MissionBoard', () => {
  it('renders one row per mission, in the order given', () => {
    render(<MissionBoard missions={[due, goal]} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/12 cards are due/i);
    expect(rows[1]).toHaveTextContent(/30 XP/i);
  });

  it('packs each row with compact padding instead of a tile inset', () => {
    render(<MissionBoard missions={[due]} />);
    expect(screen.getByRole('button')).toHaveStyle({
      padding: `${SPACE[2]}px ${SPACE[3]}px`,
    });
  });

  it('uses a display heading and lets card copy wrap inside its frame', () => {
    render(<MissionBoard missions={[due]} />);
    expect(screen.getByText('Missionen')).toHaveStyle({
      fontFamily: FONTS.display,
      fontSize: `${FONT_SIZE.xl}px`,
    });
    expect(screen.getByTestId('mission-copy')).toHaveStyle({
      minWidth: '0',
      overflowWrap: 'anywhere',
    });
    expect(screen.getByTestId('mission-destination')).toHaveStyle({ marginTop: `${SPACE[1]}px` });
  });

  // The whole reason InteractiveCard is mandated here: fourteen league rows
  // once shipped as `<li onClick>` — dead to Tab, invisible to a screen reader
  // as controls — and stayed that way through a green 1,600-test suite.
  it('makes every row a real button, reachable by keyboard', () => {
    render(<MissionBoard missions={[due, goal]} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b).not.toHaveAttribute('tabindex', '-1');
    }
  });

  it('names each row by what it says AND where it goes', () => {
    render(<MissionBoard missions={[due]} />);
    expect(
      screen.getByRole('button', { name: /12 cards are due — go to Vokabeln/i })
    ).toBeInTheDocument();
  });

  it('reports the tab to go to when a row is activated', async () => {
    const onGo = vi.fn();
    render(<MissionBoard missions={[due]} onGo={onGo} />);
    await userEvent.click(screen.getByRole('button', { name: /12 cards are due/i }));
    expect(onGo).toHaveBeenCalledWith('vocab', due);
  });

  it('activates from the keyboard, not just the mouse', async () => {
    const onGo = vi.fn();
    render(<MissionBoard missions={[due]} onGo={onGo} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /12 cards are due/i })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onGo).toHaveBeenCalledWith('vocab', due);
  });

  it('congratulates rather than apologises when nothing is due', () => {
    render(<MissionBoard missions={[]} />);
    expect(screen.getByText(/alles erledigt/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('pluralises a single card correctly', () => {
    render(<MissionBoard missions={[{ ...due, count: 1 }]} />);
    expect(screen.getByText(/1 card is due/i)).toBeInTheDocument();
  });

  it('skips a mission id the pack has no copy for, instead of crashing', () => {
    render(<MissionBoard missions={[due, { id: 'not-a-mission', count: 1, tab: 'chat' }]} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  // Home is the landing tab, so a throw here is a crash on app open. The board
  // must fail inside its boundary and leave the rest of Home standing.
  it('is containable by an ErrorBoundary when a mission cannot be rendered', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exploding = {
      id: 'srs-due',
      tab: 'vocab',
      get count() {
        throw new Error('bad state');
      },
    };
    render(
      <div>
        <p>rest of Home</p>
        <ErrorBoundary>
          <MissionBoard missions={[exploding]} />
        </ErrorBoundary>
      </div>
    );
    // The siblings survive; only the board is replaced.
    expect(screen.getByText('rest of Home')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cards are due/i })).not.toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('MissionBoard — section heading typography', () => {
  // The heading used to sit at lg (16) with its rows' copy at base (13): one
  // step of separation for the only landmark on the section.
  it('sets the heading a clear step above its own row copy', () => {
    render(<MissionBoard missions={[due]} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveStyle({ fontSize: `${FONT_SIZE.xl}px` });
    expect(FONT_SIZE.xl).toBeGreaterThan(FONT_SIZE.base);
  });

  // Fraunces sets a deep descender and these headings carry them (the g in
  // "Tagesaufgaben"). A line box equal to the font size is where a glyph box
  // starts getting cut.
  it('leaves the line box room for a descender', () => {
    render(<MissionBoard missions={[due]} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(Number(heading.style.lineHeight)).toBeGreaterThanOrEqual(1.3);
  });

  // 12px was the same gap the rows use BETWEEN each other, so the heading read
  // as one more row rather than as the thing above them.
  it('separates itself from the list by more than the row gap', () => {
    render(<MissionBoard missions={[due]} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.style.margin).toContain(`${SPACE[4]}px`);
  });
});
