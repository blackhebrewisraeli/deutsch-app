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

describe('TypedAnswer question text', () => {
  it('defaults to asking for the English meaning', () => {
    render(<TypedAnswer value="" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Type the English meaning' })).toBeInTheDocument();
  });

  it('stretches the field to the card column but keeps typed text start-aligned', () => {
    // The wrapper fills the centered vocab column. The input itself stays
    // start-aligned so a long gloss is not scrolled off the left edge.
    const { container } = render(
      <TypedAnswer
        value="the long compound meaning of bread and also bakery goods"
        onChange={() => {}}
        onSubmit={() => {}}
      />
    );
    expect(container.firstChild).toHaveStyle({
      width: '100%',
      alignItems: 'stretch',
    });
    expect(screen.getByRole('textbox', { name: 'Type the English meaning' })).toHaveStyle({
      textAlign: 'start',
      width: '100%',
    });
  });

  it('can ask something else without a second component', () => {
    render(
      <TypedAnswer
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        label="Type the plural"
        placeholder="die …"
      />
    );
    const input = screen.getByRole('textbox', { name: 'Type the plural' });
    expect(input).toHaveAttribute('placeholder', 'die …');
  });
});
