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
