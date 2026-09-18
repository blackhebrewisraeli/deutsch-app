import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackInbox from './FeedbackInbox';

vi.mock('../../lib/adminApi.js', () => ({
  fetchFeedback: vi.fn(),
  updateFeedbackStatus: vi.fn(),
  deleteFeedback: vi.fn(),
}));

import { fetchFeedback, updateFeedbackStatus, deleteFeedback } from '../../lib/adminApi.js';

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'open',
  category: 'ui',
  message: 'the button overlap',
  created_at: '2026-09-18T00:00:00Z',
  surface: 'vocab',
  user_id: null,
};

describe('FeedbackInbox', () => {
  beforeEach(() => {
    fetchFeedback.mockResolvedValue({ items: [ROW] });
    updateFeedbackStatus.mockResolvedValue({ ...ROW, status: 'handled' });
    deleteFeedback.mockResolvedValue(null);
  });

  it('lists reports from the server', async () => {
    render(<FeedbackInbox />);
    expect(await screen.findByText('the button overlap')).toBeInTheDocument();
  });

  it('marks a report handled', async () => {
    render(<FeedbackInbox />);
    await screen.findByText('the button overlap');
    await userEvent.click(screen.getByRole('button', { name: /mark handled/i }));
    expect(updateFeedbackStatus).toHaveBeenCalledWith(ROW.id, 'handled');
  });

  it('deletes only after a confirm click', async () => {
    fetchFeedback.mockResolvedValueOnce({ items: [ROW] }).mockResolvedValue({ items: [] });
    render(<FeedbackInbox />);
    await screen.findByText('the button overlap');
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(deleteFeedback).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(deleteFeedback).toHaveBeenCalledWith(ROW.id);
    await waitFor(() => expect(screen.queryByText('the button overlap')).not.toBeInTheDocument());
  });
});
