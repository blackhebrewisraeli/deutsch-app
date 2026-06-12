import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CorrectionPanel from './CorrectionPanel';
import { speak } from '../../lib/speech';

vi.mock('../../lib/speech', () => ({ speak: vi.fn() }));

const correction = {
  original: 'Ich habe hunger',
  fixed: 'Ich habe Hunger',
  explain: 'Nouns are capitalized in German.',
};

describe('CorrectionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the original, the fix and the explanation', () => {
    render(<CorrectionPanel correction={correction} mobile={false} />);
    expect(screen.getByText('Ich habe hunger')).toBeInTheDocument();
    expect(screen.getByText('Ich habe Hunger')).toBeInTheDocument();
    expect(screen.getByText('Nouns are capitalized in German.')).toBeInTheDocument();
  });

  it('speaks the corrected sentence from the HEAR IT button', async () => {
    render(<CorrectionPanel correction={correction} mobile={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'HEAR IT' }));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('Ich habe Hunger');
  });

  it('renders the all-good empty state without a correction', () => {
    render(<CorrectionPanel correction={null} mobile={false} />);
    expect(screen.getByText('Alles gut!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'HEAR IT' })).not.toBeInTheDocument();
  });
});
