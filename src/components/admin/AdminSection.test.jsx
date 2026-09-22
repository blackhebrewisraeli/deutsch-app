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
vi.mock('./GodMode', () => ({
  default: () => <div>god-mode</div>,
}));

describe('AdminSection', () => {
  it('renders nothing without isAdmin', () => {
    const { container } = render(<AdminSection me={{ isAdmin: false }} />);
    expect(container).toBeEmptyDOMElement();
    render(<AdminSection me={null} />);
    expect(screen.queryByRole('tab', { name: /feedback/i })).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('tab', { name: /users/i }));
    expect(screen.getByText('user-list')).toBeInTheDocument();
  });

  it('reaches God mode, which no other tab can see', async () => {
    render(<AdminSection me={{ isAdmin: true, isSystemAccount: false }} />);
    expect(screen.queryByText('god-mode')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /god mode/i }));
    expect(screen.getByText('god-mode')).toBeInTheDocument();
    // Exactly one panel is mounted: the other two would each fire their own
    // admin request to render a list nobody is looking at.
    expect(screen.queryByText('feedback-inbox')).not.toBeInTheDocument();
    expect(screen.queryByText('user-list')).not.toBeInTheDocument();
  });

  it('names the panel the selected tab controls', async () => {
    render(<AdminSection me={{ isAdmin: true, isSystemAccount: false }} />);
    const tab = screen.getByRole('tab', { name: /users/i });
    await userEvent.click(tab);
    const panel = screen.getByRole('tabpanel');
    expect(tab).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('does not wear the app primary-action pill for navigation', () => {
    // The redesign's whole point: the section switcher is text on a rule, so a
    // reviewer can tell the loud controls (block, delete, adjust XP) apart from
    // the quiet ones. A <button role="tab"> is not counted as a `button` role,
    // so any Button primitive here would show up in this query.
    render(<AdminSection me={{ isAdmin: true, isSystemAccount: false }} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
