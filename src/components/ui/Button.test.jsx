import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('renders its children as the accessible label', () => {
    render(<Button>CHECK</Button>);
    expect(screen.getByRole('button', { name: 'CHECK' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>GO</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        GO
      </Button>
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('dims and disables the button when disabled', () => {
    render(<Button disabled>GO</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveStyle({ opacity: '0.45' });
  });

  it('falls back to the primary variant for an unknown variant (no crash)', () => {
    render(<Button variant="does-not-exist">X</Button>);
    expect(screen.getByRole('button', { name: 'X' })).toBeInTheDocument();
  });

  it('forwards extra props (e.g. type) to the underlying button', () => {
    render(<Button type="submit">SEND</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});
