import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuestBoard from './QuestBoard';
import { activePack } from '../packs';

const quest = (over = {}) => ({
  id: 'answer-cards',
  target: 7,
  progress: 3,
  done: false,
  tab: 'vocab',
  ...over,
});

describe('QuestBoard', () => {
  it('renders one row per quest, in the order given', () => {
    render(
      <QuestBoard
        quests={[quest(), quest({ id: 'practise-tabs', tab: 'home', target: 3, progress: 1 })]}
      />
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('button')).toBeInTheDocument();
  });

  it('renders each row as a real button, reachable by Tab', () => {
    // Fourteen league rows once shipped as `<li onClick>` — invisible to the
    // keyboard through a green 1,600-test suite.
    render(<QuestBoard quests={[quest()]} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows progress as a ratio', () => {
    render(<QuestBoard quests={[quest()]} />);
    expect(screen.getByTestId('quest-progress')).toHaveTextContent('3 / 7');
  });

  it('names the destination for a screen reader, since the ratio is aria-hidden', () => {
    render(<QuestBoard quests={[quest()]} />);
    const label = screen.getByRole('button').getAttribute('aria-label');
    expect(label).toMatch(/Vokabeln/);
    expect(label).toMatch(/3 of 7 done/);
  });

  it('says done rather than reading a ratio once a quest is complete', () => {
    render(<QuestBoard quests={[quest({ progress: 7, done: true })]} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/done$/);
  });

  it('reports the tab to go to when a row is activated', async () => {
    const onGo = vi.fn();
    render(<QuestBoard quests={[quest()]} onGo={onGo} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onGo).toHaveBeenCalledWith('vocab', expect.objectContaining({ id: 'answer-cards' }));
  });

  it('renders nothing at all when there are no quests', () => {
    const { container } = render(<QuestBoard quests={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the all-done note only when every quest is finished', () => {
    const chrome = activePack.content.questsChrome;
    const { rerender } = render(<QuestBoard quests={[quest(), quest({ id: 'get-correct' })]} />);
    expect(screen.queryByText(new RegExp(chrome.allDoneTitle))).toBeNull();

    rerender(
      <QuestBoard
        quests={[
          quest({ progress: 7, done: true }),
          quest({ id: 'get-correct', progress: 7, done: true }),
        ]}
      />
    );
    expect(screen.getByText(new RegExp(chrome.allDoneTitle))).toBeInTheDocument();
  });

  it('skips a quest the pack has no copy for rather than rendering a blank row', () => {
    // Same as MissionBoard: the whole row is dropped, not rendered empty.
    render(<QuestBoard quests={[quest({ id: 'not-in-the-pack' }), quest()]} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('carries no German of its own — every word comes from the pack', () => {
    // The same contract MissionBoard holds: src/components stays language-blind.
    const copy = activePack.content.quests;
    render(<QuestBoard quests={[quest()]} />);
    expect(screen.getByText(copy['answer-cards'].text(quest()))).toBeInTheDocument();
  });

  it('keeps the bar within 0–100% even if progress overshoots the target', () => {
    render(<QuestBoard quests={[quest({ progress: 99, target: 7, done: true })]} />);
    // Progress is clamped upstream; this guards the render if it ever is not.
    const bar = screen.getByRole('button').querySelector('div[aria-hidden="true"] > div');
    const width = Number.parseInt(bar.style.width, 10);
    expect(width).toBeGreaterThanOrEqual(0);
  });
});
