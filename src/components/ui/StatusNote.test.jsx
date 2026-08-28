import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart3 } from 'lucide-react';
import StatusNote from './StatusNote';

describe('StatusNote', () => {
  it('renders the message', () => {
    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    expect(screen.getByText('Nichts hier.')).toBeInTheDocument();
  });

  it('defaults to the empty tone: muted ink, italic', () => {
    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    const msg = screen.getByText('Nichts hier.');
    expect(msg).toHaveStyle({ color: 'var(--c-fg-muted)' });
    expect(msg).toHaveStyle({ fontStyle: 'italic' });
  });

  // Upright, not italic: an error set in italic reads as an aside.
  it('uses error ink and no italic for the error tone', () => {
    render(
      <StatusNote tone="error" icon={BarChart3}>
        Kaputt.
      </StatusNote>
    );
    const msg = screen.getByText('Kaputt.');
    expect(msg).toHaveStyle({ color: 'var(--c-error)' });
    expect(msg).not.toHaveStyle({ fontStyle: 'italic' });
  });

  // The whole of finding F1. The three errors this replaces all appear AFTER an
  // async failure, swapping out loading content. Without a live region that
  // substitution is silent to a screen reader.
  it('announces an error and stays silent when empty', () => {
    const { unmount } = render(
      <StatusNote tone="error" icon={BarChart3}>
        Kaputt.
      </StatusNote>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Kaputt.');
    unmount();

    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides the icon from assistive tech', () => {
    const { container } = render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no action button unless one is passed', () => {
    render(<StatusNote icon={BarChart3}>Nichts hier.</StatusNote>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the action and calls it', async () => {
    const onClick = vi.fn();
    render(
      <StatusNote tone="error" icon={BarChart3} action={{ label: 'Retry', onClick }}>
        Kaputt.
      </StatusNote>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // Finding F2: the one existing retry control in the app is a bare <button>
  // with an underline, so injectGlobalStyles' single [data-ui] focus ring never
  // matches it. Going through Button is what closes that.
  it('gives the action the app focus ring by routing through Button', () => {
    render(
      <StatusNote tone="error" icon={BarChart3} action={{ label: 'Retry', onClick: () => {} }}>
        Kaputt.
      </StatusNote>
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute('data-ui', 'button');
  });

  it("lets the caller's style win", () => {
    render(
      <StatusNote icon={BarChart3} data-testid="n" style={{ padding: '1px' }}>
        Nichts hier.
      </StatusNote>
    );
    expect(screen.getByTestId('n')).toHaveStyle({ padding: '1px' });
  });
});
