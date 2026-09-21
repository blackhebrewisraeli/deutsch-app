import LegalPage from './LegalPage';

/**
 * Terms of Service. As with the privacy policy, the wording is supplied copy
 * and is reproduced verbatim.
 *
 * The source text numbers each clause with its heading on the same line
 * ("1. Eligibility: You must be…"). Splitting the label from the body keeps
 * the document navigable by heading without altering a word of it.
 */
const SECTIONS = [
  {
    heading: '1. Eligibility',
    paragraphs: [
      'You must be at least 13 years old to use this app. By creating an account, you confirm that you meet this age requirement.',
    ],
  },
  {
    heading: '2. User Accounts',
    paragraphs: [
      "You are responsible for maintaining the security of your account. We reserve the right to suspend or terminate accounts that violate these terms or abuse the platform's systems.",
    ],
  },
  {
    heading: '3. App Usage and Leagues',
    paragraphs: [
      'Deutsch App includes gamified elements like Leagues and Streaks. We reserve the right to reset, modify, or adjust league standings, points, or progression logic at any time, especially during this pre-beta phase, to ensure a fair experience for all users.',
    ],
  },
  {
    heading: '4. User-Generated Content',
    paragraphs: [
      'If you upload an avatar or any other content, you must ensure you have the rights to use it. We reserve the right to remove any content that is deemed inappropriate, offensive, or infringing on copyright.',
    ],
  },
  {
    heading: '5. "As Is" Disclaimer',
    paragraphs: [
      'Deutsch App is currently in a pre-beta stage. The service is provided "AS IS" and "AS AVAILABLE," without warranties of any kind.',
    ],
  },
];

export default function TermsOfService({ onBack }) {
  return (
    <LegalPage
      title="Terms of Service"
      updated="Last Updated: September 2026"
      intro="By accessing or using Deutsch App, you agree to be bound by these Terms of Service."
      sections={SECTIONS}
      onBack={onBack}
    />
  );
}
