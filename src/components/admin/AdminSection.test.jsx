import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminSection from './AdminSection';

vi.mock('./FeedbackInbox', () => ({
  default: () => <div>feedback-inbox</div>,
}));
vi.mock('./UserList', () => ({
  default: () => <div>user-list</div>,
}));

describe('AdminSection', () => {
  it('renders nothing without isAdmin', () => {
    const { container } = render(<AdminSection me={{ isAdmin: false }} />);
    expect(container).toBeEmptyDOMElement();
    render(<AdminSection me={null} />);
    expect(screen.queryByRole('button', { name: /feedback/i })).not.toBeInTheDocument();
  });

  it('does not appear because localStorage claimed admin', () => {
    localStorage.setItem('isAdmin', 'true');
    const { container } = render(<AdminSection me={{ isAdmin: false, isSystemAccount: false }} />);
    expect(container).toBeEmptyDOMElement();
    localStorage.clear();
  });

  it('shows feedback by default and switches to users', async () => {
    render(<AdminSection me={{ isAdmin: true, isSystemAccount: true }} />);
    expect(screen.getByText('feedback-inbox')).toBeInTheDocument();
    expect(screen.getByText(/system account/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /users/i }));
    expect(screen.getByText('user-list')).toBeInTheDocument();
  });
});
