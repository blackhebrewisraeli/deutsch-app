import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacyPolicy from './PrivacyPolicy';

describe('PrivacyPolicy', () => {
  it('renders the document title and the updated stamp', () => {
    render(<PrivacyPolicy />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Last Updated: September 2026')).toBeInTheDocument();
  });

  it('carries all four numbered sections, in order', () => {
    render(<PrivacyPolicy />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '1. Information We Collect',
      '2. How We Use Your Information',
      '3. Third-Party Services',
      '4. Data Export and Deletion',
    ]);
  });

  // The wording is supplied legal copy. These assertions exist so an edit that
  // "tightens" it fails a test instead of quietly changing what was published.
  it('reproduces the supplied copy verbatim', () => {
    render(<PrivacyPolicy />);
    for (const phrase of [
      'Welcome to Deutsch App. This Privacy Policy explains how we collect, use, and protect your information when you use our application.',
      'When you sign in (via Google or Magic Link), we collect your email address to securely authenticate you and maintain your learning progress across devices.',
      'We store your vocabulary progress, exercise completion, and streak history locally on your device and sync it to our cloud database.',
      'We use Sentry to automatically collect crash reports and performance data to help us fix bugs. This data is scrubbed of personally identifiable information (PII) before leaving your device.',
      'We do not sell your data or use it for targeted advertising.',
      'We utilize trusted third-party infrastructure to run the app: Supabase (secure authentication and database hosting), Vercel (application hosting), and Sentry (error tracking and performance monitoring).',
      'You have full control over your data.',
    ]) {
      expect(
        screen.getByText(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      ).toBeInTheDocument();
    }
  });

  it('lists the three collection categories as a real list', () => {
    render(<PrivacyPolicy />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    for (const term of ['Account Information:', 'Learning Data:', 'Usage & Error Data:']) {
      expect(screen.getByText(term)).toBeInTheDocument();
    }
  });

  it('passes its back control through', async () => {
    const onBack = vi.fn();
    render(<PrivacyPolicy onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back to the app' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
