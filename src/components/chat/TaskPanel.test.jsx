import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskPanel from './TaskPanel';

const task = { task: 'Order a coffee politely.', hint: 'Ich hätte gern…' };

const baseProps = {
  currentTask: task,
  taskIdx: 0,
  tasksCompleted: false,
  hintVisible: false,
  setHintVisible: () => {},
  onResetTasks: () => {},
};

describe('TaskPanel', () => {
  // The task card and a WRONG answer used to paint from the same token
  // (`COLORS.red` is `--c-error`), so the app said "your assignment" and "you
  // got it wrong" in one colour. Asserted rather than trusted: the two are
  // still visually similar reds, so collapsing them back would look fine in a
  // screenshot and be caught by nothing else.
  it('paints the task chrome from the flag red tier, never the error token', () => {
    const { container } = render(<TaskPanel {...baseProps} />);
    // Match the fill exactly: `accent-red-on` is a substring of `accent-red`,
    // and the hint button carries the ink, so a loose match counts three.
    const filled = [...container.querySelectorAll('*')].filter((el) =>
      /background:\s*var\(--c-accent-red\)/.test(el.getAttribute('style') ?? '')
    );
    expect(filled.length, 'task marker + task card should both use accent-red').toBe(2);

    for (const el of container.querySelectorAll('*')) {
      const style = el.getAttribute('style') ?? '';
      expect(style, `${el.tagName} must not paint task chrome from --c-error`).not.toMatch(
        /background:\s*var\(--c-error\)/
      );
    }
  });

  it('renders the numbered task with its text', () => {
    render(<TaskPanel {...baseProps} taskIdx={2} />);
    expect(screen.getByText('TASK 3')).toBeInTheDocument();
    expect(screen.getByText('Order a coffee politely.')).toBeInTheDocument();
  });

  it('hides the hint until requested, then toggles via setHintVisible', async () => {
    const setHintVisible = vi.fn();
    render(<TaskPanel {...baseProps} setHintVisible={setHintVisible} />);
    expect(screen.queryByText('Ich hätte gern…')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'SHOW HINT' }));
    expect(setHintVisible).toHaveBeenCalledTimes(1);
  });

  it('shows the hint text and the HIDE HINT label when hintVisible', () => {
    render(<TaskPanel {...baseProps} hintVisible />);
    expect(screen.getByText('Ich hätte gern…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'HIDE HINT' })).toBeInTheDocument();
  });

  it('omits the hint button for a task without a hint', () => {
    render(<TaskPanel {...baseProps} currentTask={{ task: 'Say hello.' }} />);
    expect(screen.getByText('Say hello.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SHOW HINT' })).not.toBeInTheDocument();
  });

  it('renders the completed card with CONTINUE resetting the cycle', async () => {
    const onResetTasks = vi.fn();
    render(<TaskPanel {...baseProps} tasksCompleted onResetTasks={onResetTasks} />);
    expect(screen.getByText('✓ ALL TASKS DONE')).toBeInTheDocument();
    expect(screen.queryByText('Order a coffee politely.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'CONTINUE' }));
    expect(onResetTasks).toHaveBeenCalledTimes(1);
  });
});
