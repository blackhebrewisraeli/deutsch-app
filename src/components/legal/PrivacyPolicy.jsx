import LegalPage from './LegalPage';

/**
 * Privacy Policy. The wording is supplied copy and is reproduced verbatim —
 * treat it as a legal text, not as UI copy to be tightened. Structure is the
 * only thing this file decides.
 */
const SECTIONS = [
  {
    heading: '1. Information We Collect',
    items: [
      {
        term: 'Account Information:',
        text: 'When you sign in (via Google or Magic Link), we collect your email address to securely authenticate you and maintain your learning progress across devices.',
      },
      {
        term: 'Learning Data:',
        text: 'We store your vocabulary progress, exercise completion, and streak history locally on your device and sync it to our cloud database.',
      },
      {
        term: 'Usage & Error Data:',
        text: 'We use Sentry to automatically collect crash reports and performance data to help us fix bugs. This data is scrubbed of personally identifiable information (PII) before leaving your device.',
      },
    ],
  },
  {
    heading: '2. How We Use Your Information',
    paragraphs: [
      'Your data is used strictly to provide the core functionality of the app: saving your progress, placing you in leaderboards (Leagues), and ensuring the app runs smoothly offline and online. We do not sell your data or use it for targeted advertising.',
    ],
  },
  {
    heading: '3. Third-Party Services',
    paragraphs: [
      'We utilize trusted third-party infrastructure to run the app: Supabase (secure authentication and database hosting), Vercel (application hosting), and Sentry (error tracking and performance monitoring).',
    ],
  },
  {
    heading: '4. Data Export and Deletion',
    paragraphs: [
      'You have full control over your data. You can export your learning progress or permanently delete your account and all associated data directly from the "Profile/Settings" section within the app.',
    ],
  },
];

export default function PrivacyPolicy({ onBack }) {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="Last Updated: September 2026"
      intro="Welcome to Deutsch App. This Privacy Policy explains how we collect, use, and protect your information when you use our application."
      sections={SECTIONS}
      onBack={onBack}
    />
  );
}
