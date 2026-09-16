import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflineCacheSection from './OfflineCacheSection';

const cleared = (deleted = ['lexicon-json']) => ({
  ok: true,
  available: true,
  deleted,
  failed: [],
  reason: 'cleared',
});

describe('OfflineCacheSection', () => {
  it('offers a Clear offline cache control', () => {
    render(<OfflineCacheSection clearCaches={vi.fn()} resetLexicon={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear offline cache/i })).toBeInTheDocument();
  });

  it('clears Cache Storage, then drops the in-memory lexicon so the next load refetches', async () => {
    const order = [];
    const clearCaches = vi.fn(async () => {
      order.push('clear');
      return cleared();
    });
    const resetLexicon = vi.fn(() => {
      order.push('reset');
    });
    const onToast = vi.fn();
    render(
      <OfflineCacheSection
        clearCaches={clearCaches}
        resetLexicon={resetLexicon}
        onToast={onToast}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /clear offline cache/i }));

    expect(clearCaches).toHaveBeenCalledTimes(1);
    expect(resetLexicon).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['clear', 'reset']);
    expect(onToast).toHaveBeenCalledWith('Offline cache cleared.');
    expect(screen.getByRole('status')).toHaveTextContent(/offline cache cleared/i);
  });

  it('does not reset the in-memory lexicon when Cache Storage is unavailable', async () => {
    const resetLexicon = vi.fn();
    const onToast = vi.fn();
    render(
      <OfflineCacheSection
        clearCaches={async () => ({
          ok: true,
          available: false,
          deleted: [],
          failed: [],
          reason: 'unsupported',
        })}
        resetLexicon={resetLexicon}
        onToast={onToast}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /clear offline cache/i }));

    expect(resetLexicon).not.toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith('Offline cache is not available in this browser.');
  });

  it('does not reset the in-memory lexicon when a delete fails', async () => {
    const resetLexicon = vi.fn();
    render(
      <OfflineCacheSection
        clearCaches={async () => ({
          ok: false,
          available: true,
          deleted: [],
          failed: ['lexicon-json'],
          reason: 'partial',
        })}
        resetLexicon={resetLexicon}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /clear offline cache/i }));

    expect(resetLexicon).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/could not clear/i);
  });

  it('reports an empty Cache Storage as nothing to clear', async () => {
    const resetLexicon = vi.fn();
    render(
      <OfflineCacheSection clearCaches={async () => cleared([])} resetLexicon={resetLexicon} />
    );

    await userEvent.click(screen.getByRole('button', { name: /clear offline cache/i }));

    expect(resetLexicon).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/no offline caches to clear/i);
  });

  it('does not throw through the button when the helper rejects', async () => {
    const resetLexicon = vi.fn();
    render(
      <OfflineCacheSection
        clearCaches={async () => {
          throw new Error('boom');
        }}
        resetLexicon={resetLexicon}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /clear offline cache/i }));

    expect(resetLexicon).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/could not clear/i);
  });
});
