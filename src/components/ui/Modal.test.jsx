import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import Modal from './Modal';

afterEach(() => {
  cleanup();
});

describe('Modal', () => {
  it('renders a labelled dialog with the given content', () => {
    render(
      <Modal label="Follower" onClose={() => {}}>
        <p>Hello</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog', { name: 'Follower' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal label="Follower" onClose={onClose}>
        <p>Hello</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the scrim is clicked, but not when the card itself is', () => {
    const onClose = vi.fn();
    render(
      <Modal label="Follower" onClose={onClose}>
        <p>Hello</p>
      </Modal>
    );

    fireEvent.click(screen.getByText('Hello'));
    expect(onClose).not.toHaveBeenCalled();

    // The scrim is the dialog's own parent — clicking it, not the card, is a
    // click outside the content.
    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the explicit close button', () => {
    const onClose = vi.fn();
    render(
      <Modal label="Follower" onClose={onClose}>
        <p>Hello</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to whatever opened it once it unmounts', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Modal label="Follower" onClose={() => setOpen(false)}>
              <p>Hello</p>
            </Modal>
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(opener);
  });
});
