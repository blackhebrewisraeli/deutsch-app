import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TermsOfService from './TermsOfService';

describe('TermsOfService', () => {
  it('renders the document title and the updated stamp', () => {
    render(<TermsOfService />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText('Last Updated: September 2026')).toBeInTheDocument();
  });

  it('carries all five numbered clauses, in order', () => {
    render(<TermsOfService />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '1. Eligibility',
      '2. User Accounts',
      '3. App Usage and Leagues',
      '4. User-Generated Content',
      '5. "As Is" Disclaimer',
    ]);
  });

  // Supplied legal copy — see the note in PrivacyPolicy.test.jsx.
  it('reproduces the supplied copy verbatim', () => {
    render(<TermsOfService />);
    for (const phrase of [
      'By accessing or using Deutsch App, you agree to be bound by these Terms of Service.',
      'You must be at least 13 years old to use this app. By creating an account, you confirm that you meet this age requirement.',
      "You are responsible for maintaining the security of your account. We reserve the right to suspend or terminate accounts that violate these terms or abuse the platform's systems.",
      'We reserve the right to reset, modify, or adjust league standings, points, or progression logic at any time, especially during this pre-beta phase, to ensure a fair experience for all users.',
      'If you upload an avatar or any other content, you must ensure you have the rights to use it.',
      'The service is provided "AS IS" and "AS AVAILABLE," without warranties of any kind.',
    ]) {
      expect(
        screen.getByText(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      ).toBeInTheDocument();
    }
  });

  it('states the minimum age, which is the clause most likely to be edited by accident', () => {
    render(<TermsOfService />);
    expect(screen.getByText(/at least 13 years old/)).toBeInTheDocument();
  });

  it('passes its back control through', async () => {
    const onBack = vi.fn();
    render(<TermsOfService onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back to the app' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
