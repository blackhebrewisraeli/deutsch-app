import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatExercise from './ChatExercise';
import { SPACE } from '../../lib/theme';

const PAYLOAD = {
  initialMessage: 'Guten Tag! Wie heißt du?',
  persona: 'Anna',
};

describe('ChatExercise', () => {
  it('shows the persona and the opening message, with an empty composer', () => {
    render(<ChatExercise type="chat" payload={PAYLOAD} />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Guten Tag! Wie heißt du?')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveValue('');
    expect(screen.queryByText('Ich heiße Sam.')).not.toBeInTheDocument();
  });

  it('appends a drafted reply locally and clears the composer', async () => {
    render(<ChatExercise type="chat" payload={PAYLOAD} />);
    await userEvent.type(screen.getByRole('textbox', { name: /message/i }), 'Ich heiße Sam.');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(screen.getByText('Ich heiße Sam.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveValue('');
  });

  it('does not append a blank reply', async () => {
    render(<ChatExercise type="chat" payload={PAYLOAD} />);
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('uses thumb-sized touch targets on the composer', () => {
    render(<ChatExercise type="chat" payload={PAYLOAD} />);
    expect(screen.getByRole('textbox', { name: /message/i })).toHaveStyle({
      minHeight: `${SPACE[12]}px`,
    });
    expect(screen.getByRole('button', { name: /send/i })).toHaveStyle({
      minHeight: `${SPACE[12]}px`,
      minWidth: `${SPACE[12]}px`,
    });
  });

  it('keeps the composer clear of the home indicator', () => {
    const { container } = render(<ChatExercise type="chat" payload={PAYLOAD} />);
    const composer = container.querySelector('form');
    expect(composer.style.paddingBottom).toContain('safe-area-inset-bottom');
  });

  it('lets a long compound break instead of widening the page', () => {
    render(
      <ChatExercise
        type="chat"
        payload={{
          initialMessage: 'Donaudampfschifffahrtsgesellschaftskapitän',
          persona: 'Anna',
        }}
      />
    );
    expect(screen.getByText('Donaudampfschifffahrtsgesellschaftskapitän')).toHaveStyle({
      overflowWrap: 'anywhere',
    });
  });

  it('tolerates a missing or empty payload without throwing', () => {
    render(<ChatExercise type="chat" />);
    expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });
});
