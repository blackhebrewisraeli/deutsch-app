import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypedAnswer from './TypedAnswer';

describe('TypedAnswer', () => {
  it('disables CHECK until something non-blank is typed', () => {
    const { rerender } = render(<TypedAnswer value="" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /CHECK/ })).toBeDisabled();

    rerender(<TypedAnswer value="   " onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /CHECK/ })).toBeDisabled();

    rerender(<TypedAnswer value="bread" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /CHECK/ })).toBeEnabled();
  });

  it('reports each keystroke to the parent', async () => {
    const onChange = vi.fn();
    render(<TypedAnswer value="" onChange={onChange} onSubmit={() => {}} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Type the English meaning' }), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('submits on Enter as well as on the button', async () => {
    const onSubmit = vi.fn();
    render(<TypedAnswer value="bread" onChange={() => {}} onSubmit={onSubmit} />);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Type the English meaning' }),
      '{Enter}'
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /CHECK/ }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
